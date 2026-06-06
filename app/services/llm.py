from openai import AsyncOpenAI

from app.config import get_settings
from app.models.company import Company
from app.models.message import Message
from app.services.embeddings import _require_api_key

settings = get_settings()

SYSTEM_PROMPT = """You are a business intelligence assistant for a company owner.
Answer questions using ONLY the team updates provided in the user message.
Rules:
- Be specific and concise.
- Reference authors and dates when relevant.
- If the updates do not contain enough information, say: "I don't have enough information in this week's updates to answer that."
- Do not invent facts, deals, orders, or events not present in the updates.
- Do not mention other companies or generic advice."""


def format_context(company: Company, messages: list[tuple[Message, float]]) -> str:
    lines = [f"Company: {company.name} ({company.industry})"]
    lines.append("Team updates (most relevant first):")

    if not messages:
        lines.append("(No updates available)")
        return "\n".join(lines)

    for message, similarity in messages:
        timestamp = message.created_at.strftime("%Y-%m-%d %H:%M UTC")
        lines.append(
            f"- [{timestamp}] {message.author.name} (id={message.id}, relevance={similarity:.2f}): {message.content}"
        )

    return "\n".join(lines)


async def generate_answer(
    company: Company,
    question: str,
    messages: list[tuple[Message, float]],
) -> str:
    client = AsyncOpenAI(api_key=_require_api_key())
    context = format_context(company, messages)
    user_prompt = f"{context}\n\nOwner question: {question}"

    response = await client.chat.completions.create(
        model=settings.chat_model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    return response.choices[0].message.content or "", user_prompt
