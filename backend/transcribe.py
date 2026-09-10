import sys
import os
import whisper
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Force stdout to UTF-8 to prevent encoding corruption (replacement characters) on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def transcribe(file_path, ffmpeg_dir=None):
    if ffmpeg_dir:
        # Add ffmpeg directory to the PATH so whisper (which uses ffmpeg under the hood) can find it
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

    # Use the 'base' model for better Spanish accuracy while remaining very fast on CPU.
    model = whisper.load_model("base")
    
    # Guide Whisper with context for common Spanish chat expressions, days, and medical consult terms
    prompt_context = (
        "Conversación informal en español sobre turnos, consultas médicas y agenda. "
        "Palabras y expresiones comunes: lunes, martes, miércoles, jueves, viernes, sábado, domingo, "
        "dale, oki, gracias, hola, turno, consulta, doctor, consultorio."
    )
    result = model.transcribe(file_path, language="es", initial_prompt=prompt_context)
    print(result["text"].strip())

if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_to_transcribe = sys.argv[1]
        ffmpeg_directory = sys.argv[2] if len(sys.argv) > 2 else None
        transcribe(file_to_transcribe, ffmpeg_directory)
