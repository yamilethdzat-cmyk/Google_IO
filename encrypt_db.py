import os
import shutil
import tempfile
import json
import hashlib
import base64
import openpyxl

def rc4(key, data):
    S = list(range(256))
    j = 0
    out = []
    # KSA
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) % 256
        S[i], S[j] = S[j], S[i]
    # PRGA
    i = 0
    j = 0
    for byte in data:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        t = (S[i] + S[j]) % 256
        k = S[t]
        out.append(byte ^ k)
    return bytes(out)

def encrypt(password, plaintext):
    key = hashlib.sha256(password.encode('utf-8')).digest()
    encrypted_bytes = rc4(key, plaintext.encode('utf-8'))
    return base64.b64encode(encrypted_bytes).decode('utf-8')

def main():
    excel_path = "Nombres_GDG_2026.xlsx"
    if not os.path.exists(excel_path):
        print(f"Error: No se encontró el archivo '{excel_path}'")
        return

    # Crear una copia temporal del archivo para evitar bloqueos
    temp_dir = tempfile.gettempdir()
    temp_excel_path = os.path.join(temp_dir, "Nombres_GDG_2026_temp.xlsx")
    try:
        shutil.copy2(excel_path, temp_excel_path)
        print(f"Copia temporal creada en: {temp_excel_path}")
    except Exception as e:
        print(f"Error al copiar archivo: {e}")
        return

    try:
        # Cargar libro
        wb = openpyxl.load_workbook(temp_excel_path)
        ws = wb.active

        # Identificar las columnas
        headers = [ws.cell(1, c).value for c in range(1, 10) if ws.cell(1, c).value is not None]
        print("Columnas encontradas:", headers)

        email_idx = None
        first_name_idx = None
        last_name_idx = None

        for idx, h in enumerate(headers):
            h_clean = str(h).strip().lower()
            if h_clean == 'email':
                email_idx = idx + 1
            elif h_clean == 'first name':
                first_name_idx = idx + 1
            elif h_clean == 'last name':
                last_name_idx = idx + 1

        if email_idx is None or first_name_idx is None or last_name_idx is None:
            print("Error: No se encontraron las columnas necesarias ('First Name', 'Last Name', 'Email')")
            return

        participantes = []
        max_row = ws.max_row
        print(f"Procesando {max_row} filas...")
        for row in range(2, max_row + 1):
            email = ws.cell(row, email_idx).value
            first_name = ws.cell(row, first_name_idx).value
            last_name = ws.cell(row, last_name_idx).value

            if email and first_name:
                participantes.append({
                    "first_name": str(first_name).strip(),
                    "last_name": str(last_name).strip() if last_name else "",
                    "email": str(email).strip().lower()
                })

        print(f"Total de participantes extraídos: {len(participantes)}")

        password = input("Ingresa la contraseña para encriptar la base de datos: ").strip()
        if not password:
            print("Error: La contraseña no puede estar vacía.")
            return

        # Serializar a JSON
        json_data = json.dumps(participantes, ensure_ascii=False)
        
        # Encriptar
        encrypted_str = encrypt(password, json_data)

        # Guardar en participantes.enc
        with open("participantes.enc", "w", encoding="utf-8") as f:
            f.write(encrypted_str)
        print("Base de datos encriptada guardada exitosamente en 'participantes.enc'")

    except Exception as e:
        print(f"Error durante el procesamiento: {e}")
    finally:
        # Limpiar copia temporal
        if os.path.exists(temp_excel_path):
            try:
                os.remove(temp_excel_path)
                print("Archivo temporal eliminado.")
            except Exception as e:
                print(f"No se pudo eliminar el archivo temporal: {e}")

if __name__ == "__main__":
    main()
