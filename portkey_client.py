import os
import sys
import httpx
from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

_HTTP_CLIENT = httpx.Client(verify=False, timeout=120.0)

_ANALYST_MODEL   = os.getenv("PORTKEY_ANALYST_MODEL", "gpt-4o-mini")
_ANALYST_PROVIDER = os.getenv("PORTKEY_ANALYST_PROVIDER", "az-openai")

_CODER_MODEL     = os.getenv("PORTKEY_CODER_MODEL", "gpt-4o")
_CODER_PROVIDER  = os.getenv("PORTKEY_CODER_PROVIDER", "az-openai")

_TESTER_MODEL    = os.getenv("PORTKEY_TESTER_MODEL", "gpt-4o-mini")
_TESTER_PROVIDER = os.getenv("PORTKEY_TESTER_PROVIDER", "az-openai")

_REVIEWER_MODEL    = os.getenv("PORTKEY_REVIEWER_MODEL", "gpt-4o-mini")
_REVIEWER_PROVIDER = os.getenv("PORTKEY_REVIEWER_PROVIDER", "az-openai")

AGENT_MODELS = {
    "analyst":  _ANALYST_MODEL,
    "coder":    _CODER_MODEL,
    "tester":   _TESTER_MODEL,
    "reviewer": _REVIEWER_MODEL,
    "default":  _ANALYST_MODEL,
}

AGENT_PROVIDERS = {
    "analyst":  _ANALYST_PROVIDER,
    "coder":    _CODER_PROVIDER,
    "tester":   _TESTER_PROVIDER,
    "reviewer": _REVIEWER_PROVIDER,
    "default":  _ANALYST_PROVIDER,
}

AGENT_TEMPERATURES = {
    "analyst":  0.3,
    "coder":    0.2,
    "tester":   0.1,
    "reviewer": 0.3,
    "default":  0.2,
}


def get_portkey_client(provider=None):
    api_key  = os.getenv("PORTKEY_API_KEY")
    default_provider = provider or os.getenv("PORTKEY_PROVIDER", "az-openai")
    base_url = os.getenv("PORTKEY_BASE_URL", "https://portkey.syngenta.com/v1")

    if not api_key:
        print("ERROR: PORTKEY_API_KEY not set in .env")
        sys.exit(1)

    return Portkey(api_key=api_key, virtual_key=default_provider, base_url=base_url, http_client=_HTTP_CLIENT, max_retries=0)


def call_llm(system_prompt, user_prompt, agent="default", model=None, temperature=None, metadata=None):
    try:
        resolved_provider = AGENT_PROVIDERS.get(agent, _ANALYST_PROVIDER)
        client = get_portkey_client(provider=resolved_provider)
        resolved_model = model or AGENT_MODELS.get(agent, _ANALYST_MODEL)
        resolved_temp  = temperature if temperature is not None else AGENT_TEMPERATURES.get(agent, 0.2)

        print(f"[portkey] agent={agent} provider={resolved_provider} model={resolved_model} temp={resolved_temp}")

        response = client.chat.completions.create(
            model=resolved_model,
            temperature=resolved_temp,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        
        if not response:
            raise Exception("Portkey returned no response")
        
        if not hasattr(response, 'choices') or not response.choices:
            raise Exception(f"Invalid response format from Portkey: {response}")
        
        content = response.choices[0].message.content
        
        if not content or content.strip() == "":
            raise Exception("Portkey returned empty content")
        
        return content
    
    except Exception as e:
        print(f"[portkey] ✗ ERROR with {agent} agent: {type(e).__name__}: {e}")
        raise
