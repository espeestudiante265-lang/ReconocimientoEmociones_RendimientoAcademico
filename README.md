# Detección de Emociones

Este es un proyecto que implementa un sistema de **reconocimiento de emociones** utilizando técnicas de **IA y aprendizaje automático**. El sistema está dividido en dos partes: el **backend** (Django) y el **frontend** (Next.js).

## Estructura del Proyecto

ReconocimientoEmociones/
│
├── backend/ # Código del backend (Django)
│
└── reconocimiento/ # Código del frontend (Next.js)

## Requisitos

### Backend (Django)
- Python 3.x
- Django
- PostgreSQL (o la base de datos que se utilice)
- Otras dependencias del backend (ver `requirements.txt`)

### Frontend (Next.js)
- Node.js
- npm (o yarn)
  
## Configuración del Proyecto

### Backend

## 1. Clona el repositorio:

git clone https://github.com/Steevenrb/ProyectoReconocimientoEmociones

## 2. Navega al directorio backend/ y crea un entorno virtual:

cd backend/
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

## 3. Instala las dependencias:

pip install -r requirements.txt

## 4. Realiza las migraciones de la base de datos:

python manage.py migrate

## 5. Inicia el servidor Django:

python manage.py runserver

### Frontend

## 6. Navega al directorio reconocimiento/:

cd ../reconocimiento/

## 7. Instala las dependencias de Node.js:

npm install

## 8. Ejecuta el servidor de desarrollo de Next.js:

npm run dev
Abre el navegador y visita http://localhost:3000 para ver la aplicación.