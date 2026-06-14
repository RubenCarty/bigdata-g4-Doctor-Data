# Datos del Proyecto

## Datos de entrenamiento
Los datos crudos NO se suben a GitHub por su tamaño y porque pueden contener información sensible.

## Cómo obtener los datos
1. Ejecutar el generador de datos sintéticos: `python src/generador_datos.py`
2. Los datos se guardan en `data/raw/` (ignorado por .gitignore)
3. Solo la muestra pequeña `data/sample/` está en el repositorio

## Estructura de datos
```
data/
├── raw/         ← datos crudos (NO en GitHub, ejecutar generador)
├── processed/   ← datos procesados por PySpark (NO en GitHub)
└── sample/      ← muestra pequeña para demos (SÍ en GitHub, < 5MB)
```

## Datasets externos utilizados
- Ver README.md principal → sección Recursos y Referencias para links de descarga

