"""
Lazy proxies for emergentintegrations classes.

Importing `emergentintegrations` pulls in `litellm` at module-load time, which
adds ~15s to server cold-start. Because several route modules are imported by
`server.py` at startup, that cost was paid on every boot — slowing deploys and
causing health-probe timeouts before the app finished binding.

These proxies defer the heavy import until an AI feature is actually used: the
underlying class is imported the first time the proxy is *called* (instantiated).
All existing call sites use these symbols purely as constructors, e.g.
`LlmChat(...)`, `UserMessage(text=...)`, `ImageContent(image_base64=...)`, so the
callable proxy is a drop-in replacement.
"""
import importlib


class _LazyClass:
    """Callable proxy that imports and instantiates the real class on first use."""

    def __init__(self, module_path: str, class_name: str):
        self._module_path = module_path
        self._class_name = class_name
        self._cls = None

    def _resolve(self):
        if self._cls is None:
            module = importlib.import_module(self._module_path)
            self._cls = getattr(module, self._class_name)
        return self._cls

    def __call__(self, *args, **kwargs):
        return self._resolve()(*args, **kwargs)


LlmChat = _LazyClass("emergentintegrations.llm.chat", "LlmChat")
UserMessage = _LazyClass("emergentintegrations.llm.chat", "UserMessage")
ImageContent = _LazyClass("emergentintegrations.llm.chat", "ImageContent")
OpenAITextToSpeech = _LazyClass("emergentintegrations.llm.openai", "OpenAITextToSpeech")
OpenAISpeechToText = _LazyClass("emergentintegrations.llm.openai", "OpenAISpeechToText")
