from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import translation_backend.db as db

# Add AI provider imports
from transformers import MarianMTModel, MarianTokenizer, pipeline, AutoModelForSeq2SeqLM, AutoTokenizer
from langdetect import detect, LangDetectException

import logging

app = FastAPI(title="LingoFlow Translation API", version="0.2.0")

# --- MODEL BOOTSTRAP ----
# We load only once for performance.
# For demonstration, using Helsinki-NLP MarianMT for translation (supports many languages, open-source).
# We use langdetect library for better language detection.

def get_supported_model(src_lang: str, tgt_lang: str):
    """Return model/tokenizer for src→tgt pair using Helsinki-NLP MarianMT"""
    # MarianMT models are named like 'Helsinki-NLP/opus-mt-en-fr' for English→French
    model_name = f"Helsinki-NLP/opus-mt-{src_lang.lower()}-{tgt_lang.lower()}"
    try:
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        return model, tokenizer
    except Exception as e:
        raise RuntimeError(f"Model for translation {src_lang}->{tgt_lang} not found. ({e})")

# Use a basic cache (could be extended for prod)
model_cache = {}

def get_translation_model(src: str, tgt: str):
    key = f"{src}_{tgt}"
    if key in model_cache:
        return model_cache[key]
    model, tokenizer = get_supported_model(src, tgt)
    model_cache[key] = (model, tokenizer)
    return model, tokenizer

def ai_detect_language(text: str) -> str:
    """Robust AI-based language detection using langdetect library."""
    try:
        lang_code = detect(text)
        return lang_code
    except LangDetectException:
        return "unknown"
    except Exception:
        return "unknown"

def ai_translate(text: str, src: str, tgt: str) -> str:
    """Use MarianMT (Helsinki-NLP) for translation if available."""
    if src == tgt:
        return text  # No translation needed
    try:
        model, tokenizer = get_translation_model(src, tgt)
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        translated = model.generate(**inputs, max_new_tokens=512)
        output = tokenizer.decode(translated[0], skip_special_tokens=True)
        return output
    except Exception as ex:
        logging.exception("Translation failed")
        raise RuntimeError(f"Translation error: {ex}")



# PUBLIC_INTERFACE
class TranslationRequest(BaseModel):
    """
    Request for translation.
    """
    text: str
    source_lang: Optional[str] = None  # Allow auto-detect if None/"auto"
    target_lang: str

# PUBLIC_INTERFACE
class TranslationResponse(BaseModel):
    """
    Standardized translation response.
    """
    translated_text: str
    detected_language: Optional[str] = None
    error: Optional[str] = None

# PUBLIC_INTERFACE
class DetectLanguageRequest(BaseModel):
    """
    Request for language detection.
    """
    text: str

# PUBLIC_INTERFACE
class DetectLanguageResponse(BaseModel):
    """
    Response for language detection.
    """
    language: str
    confidence: Optional[float] = None
    error: Optional[str] = None

# PUBLIC_INTERFACE
class LanguageSupported(BaseModel):
    """
    Supported languages.
    """
    code: str
    name: str

@app.get("/languages", response_model=List[LanguageSupported])
def get_supported_languages():
    """
    PUBLIC_INTERFACE
    Get the list of supported languages from the database.
    """
    languages = db.get_supported_languages()
    return [{"code": lang["code"], "name": lang["name"]} for lang in languages]

@app.post("/detect-language", response_model=DetectLanguageResponse)
def detect_language(payload: DetectLanguageRequest):
    """
    PUBLIC_INTERFACE
    AI-powered language detection for a given text.
    """
    text = payload.text
    if not text or not text.strip():
        return DetectLanguageResponse(language="unknown", confidence=None, error="Text must not be empty.")

    try:
        detected_lang = ai_detect_language(text)
        return DetectLanguageResponse(language=detected_lang, confidence=None)  # langdetect does not give confidence
    except Exception as ex:
        logging.exception("Language detection failed")
        return DetectLanguageResponse(language="unknown", confidence=None, error=f"Detection failed: {ex}")

@app.post("/translate", response_model=TranslationResponse)
def translate_text(payload: TranslationRequest):
    """
    PUBLIC_INTERFACE
    AI-powered translation from source to target language; auto-detect if required.
    """
    if not payload.text or not payload.target_lang:
        return TranslationResponse(
            translated_text="",
            error="text and target_lang are required."
        )
    # Determine source language
    if not payload.source_lang or payload.source_lang.lower() == "auto":
        detected_lang = ai_detect_language(payload.text)
        source_lang = detected_lang
        show_detected = detected_lang
    else:
        source_lang = payload.source_lang
        show_detected = None

    try:
        # Attempt AI-powered translation if supported
        translated = ai_translate(payload.text, source_lang, payload.target_lang)
        return TranslationResponse(
            translated_text=translated,
            detected_language=show_detected
        )
    except Exception as e:
        logging.exception("Translation error")
        return TranslationResponse(
            translated_text="",
            detected_language=show_detected,
            error=str(e)
        )
