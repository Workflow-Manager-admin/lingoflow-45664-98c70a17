from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict
import translation_backend.db as db

app = FastAPI(title="LingoFlow Translation API", version="0.1.0")


# PUBLIC_INTERFACE
class TranslationRequest(BaseModel):
    text: str
    source_lang: Optional[str] = None  # Allow auto-detect if None
    target_lang: str

# PUBLIC_INTERFACE
class TranslationResponse(BaseModel):
    translated_text: str
    detected_language: Optional[str] = None

# PUBLIC_INTERFACE
class DetectLanguageRequest(BaseModel):
    text: str

# PUBLIC_INTERFACE
class DetectLanguageResponse(BaseModel):
    language: str

# PUBLIC_INTERFACE
class LanguageSupported(BaseModel):
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
    Auto-detect language for a given text. (Stub for actual detection)
    """
    text = payload.text
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    detected_lang = db.detect_language_stub(text)
    return {"language": detected_lang}


@app.post("/translate", response_model=TranslationResponse)
def translate_text(payload: TranslationRequest):
    """
    PUBLIC_INTERFACE
    Translate text from source to target language.
    """
    if not payload.text or not payload.target_lang:
        raise HTTPException(status_code=400, detail="text and target_lang are required.")
    # If source_lang is None, try to auto-detect
    source_lang = payload.source_lang or db.detect_language_stub(payload.text)
    # Placeholder: Implement actual translation in the future
    translated = db.fake_translate(payload.text, source_lang, payload.target_lang)
    return TranslationResponse(
        translated_text=translated,
        detected_language=source_lang if payload.source_lang is None else None
    )
