# Spatio-Temporal Urban Traffic Congestion Prediction and Dynamic Route Optimization in Lima Metropolitan Area Using Big Data Graph Processing and Machine Learning

> **Título en español:** Predicción Espacio-Temporal de Congestión Vehicular y Optimización Dinámica de Rutas en Lima Metropolitana mediante Procesamiento Big Data y Grafos  
> **Curso:** Big Data DD283 | Universidad Autónoma del Perú | 2026-1  
> **Grupo:** 3 | **Sector:** Smart City / Transporte / Gobierno Local

---

## Equipo

| Nombre | GitHub | Rol |
|--------|--------|-----|
| [Apellido Nombre 1] | [@usuario1](https://github.com/usuario1) | Líder + Arquitectura |
| [Apellido Nombre 2] | [@usuario2](https://github.com/usuario2) | Ingesta GPS + PySpark |
| [Apellido Nombre 3] | [@usuario3](https://github.com/usuario3) | GraphX + Neo4j + ML |
| [Apellido Nombre 4] | [@usuario4](https://github.com/usuario4) | Dashboard + Mapas interactivos |

---

## 1. Caso de Negocio

### Contexto
Lima es la **5ta ciudad más congestionada de América Latina** (TomTom Traffic Index 2024). Los limeños pierden en promedio **117 horas al año** atascados en tráfico. Los datos de GPS existen (miles de taxis, combis, buses de TransMilenio Lima, apps Uber/InDrive) pero **no se procesan para optimización en tiempo real**.

**Situación actual (punto de dolor):**
- Semáforos con tiempos fijos sin adaptarse al flujo real
- No existe predicción de congestión con 30+ minutos de anticipación
- Datos de GPS de taxis generados pero no analizados (más de 500K puntos/hora)
- Eventos (partidos Universitario/Alianza, conciertos, desfiles) no se integran al modelo

**Impacto económico:**
- Pérdida de productividad: S/ 6,200 millones/año (MTC 2023)
- Consumo extra de combustible: +25% en horas pico
- Costo promedio por conductor: 2 horas perdidas/día × S/15/hora = S/30/día

### El Problema
> Construir un sistema Big Data que procese datos GPS de 50,000 vehículos simulados en Lima, analice patrones de congestión espacio-temporales usando **grafos** (calles como nodos y aristas), y prediga la congestión con **30 minutos de anticipación** para sugerir rutas alternativas.

**¿Por qué Big Data?**
| V | Justificación |
|---|--------------|
| **Volumen** | 50K vehículos × 1 punto GPS/min × 16h/día = 48M puntos/día |
| **Velocidad** | Actualización de rutas en < 2 minutos |
| **Variedad** | GPS (lat/lon), clima SENAMHI, eventos públicos, datos OpenStreetMap |
| **Veracidad** | Señales GPS perdidas, coordenadas fuera de rango, duplicados |
| **Valor** | Reducir 20% tiempo en viaje = ahorro de S/ 1,240 millones/año |

---

## 2. Objetivo del Proyecto

**Objetivo general:**
Desarrollar un sistema de análisis y predicción de tráfico urbano en Lima usando procesamiento Big Data de datos GPS sintéticos, modelado de grafos con PySpark GraphX/Neo4j, y predicción con Machine Learning para generar alertas de congestión con 30 minutos de anticipación.

**Objetivos específicos:**
1. Generar dataset sintético realista de 50K vehículos GPS en Lima Metropolitana
2. Construir el grafo de calles de Lima usando OpenStreetMap + PySpark GraphX
3. Calcular métricas de tráfico por segmento de calle (velocidad promedio, densidad)
4. Integrar datos externos: clima SENAMHI, eventos públicos, hora/día
5. Entrenar modelo de predicción de congestión (Random Forest temporal)
6. Implementar algoritmo de ruta óptima con Dijkstra adaptativo
7. Construir dashboard de mapa interactivo con folium/kepler.gl

---

## 3. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────────┐
│              ARQUITECTURA SMART TRAFFIC LIMA                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FUENTES DE DATOS                                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│  │ Simulador  │ │OpenStreet  │ │ SENAMHI    │ │ Eventos  │  │
│  │ GPS 50K    │ │ Map (OSM)  │ │ Clima Lima │ │ públicos │  │
│  │ vehículos  │ │ GeoJSON    │ │ API        │ │ (JSON)   │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────┬─────┘  │
│        └──────────────┴──────────────┴─────────────┘        │
│                              │                               │
│  ┌───────────────────────────▼──────────────────────────┐    │
│  │            PROCESAMIENTO SPARK                       │    │
│  │   PySpark: joins, agregaciones por segmento          │    │
│  │   GraphX: grafo de calles Lima (nodos/aristas)       │    │
│  │   PageRank adaptado: identificar cuellos de botella  │    │
│  └───────────────────────────┬──────────────────────────┘    │
│                              │                               │
│  ┌───────────────────────────▼──────────────────────────┐    │
│  │          NEO4J GRAPH DATABASE                        │    │
│  │   Grafo persistente: intersecciones + calles Lima    │    │
│  │   Cypher queries: rutas óptimas en tiempo real       │    │
│  └───────────────────────────┬──────────────────────────┘    │
│                              │                               │
│  ┌───────────────────────────▼──────────────────────────┐    │
│  │    ML PREDICCION + DASHBOARD MAPA                    │    │
│  │    Random Forest: congestión en 30 min               │    │
│  │    Folium / Kepler.gl: mapa interactivo Lima          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Stack Tecnológico (100% Gratuito)

| Capa | Tecnología | Plataforma | Para qué |
|------|-----------|------------|---------|
| Simulación GPS | Faker + OSMnx | Google Colab | 50K trayectorias realistas en Lima |
| Procesamiento | PySpark 3.5 | Databricks Community | Agregaciones por segmento de calle |
| Grafos Spark | PySpark GraphX | Databricks Community | PageRank, shortest path |
| Grafos Persistentes | Neo4j | Neo4j AuraDB Free (50K nodos) | Grafo de calles Lima |
| Almacenamiento | MongoDB Atlas | Atlas M0 Free | Eventos de tráfico, predicciones |
| ML | PySpark MLlib | Databricks Community | Random Forest temporal |
| Mapas | Folium + Kepler.gl | pip install | Dashboard interactivo |
| Clima | SENAMHI API | data.gob.pe | Variables climáticas |

---

## 5. Metodología

### Modelo del Grafo de Calles
```python
# Nodo: intersección (ID, lat, lon, tipo: semáforo/rotonda/cruce)
# Arista: segmento de calle (origen, destino, longitud, carriles, velocidad_max, velocidad_actual)
# ~15,000 nodos y ~40,000 aristas para Lima Metropolitana
```

### Features del Modelo de Predicción
- Velocidad promedio del segmento en últimos 5/15/30 minutos
- Densidad de vehículos (veh/km)
- Hora del día + día de semana + mes
- ¿Es día festivo peruano?
- Eventos cercanos en radio 2km (conciertos, partidos, manifestaciones)
- Condición climática (lluvia, garúa) — correlación con SENAMHI
- Velocidad en segmentos adyacentes (propagación de congestión)

### Algoritmo de Ruta Óptima Adaptativa
1. Grafo base de calles Lima cargado en Neo4j
2. Actualización de pesos de aristas cada 2 minutos con velocidades reales
3. Dijkstra modificado: costo = tiempo estimado (distancia/velocidad_actual)
4. Predicción: evitar segmentos con alta probabilidad de congestión en 30min

---

## 6. Plan de Entregables por Semana

| Semana | Entregable | Notebook | Criterio de éxito |
|--------|-----------|----------|-------------------|
| **S1** | Dataset GPS + EDA Lima | `01_EDA_trafico_lima.ipynb` | 50K trayectorias, mapa de calor de densidad |
| **S2** | Pipeline PySpark + GraphX | `02_grafo_calles_spark.ipynb` | Grafo Lima 15K nodos, PageRank calculado |
| **S3** | Neo4j + rutas óptimas | `03_neo4j_rutas.ipynb` | Cypher: ruta Miraflores→SJL en < 2s |
| **S4** | **EP: Arquitectura + Grafo + Análisis** | `presentacion_EP_grupo3.pdf` | 60% proyecto presentado |
| **S5** | Spark SQL + análisis temporal | `04_spark_sql_patrones.ipynb` | Patrones hora pico, congestión por zona |
| **S6** | Modelo predicción congestión | `05_modelo_congestion.ipynb` | F1-Score > 0.78 predicción a 30 min |
| **S7** | Scraping eventos + integración | `06_scraping_eventos.ipynb` | Scraping agenda Lima, integrado al modelo |
| **S8** | **EF: Sistema completo + mapa** | `presentacion_EF_grupo3.pdf` | Demo mapa interactivo Lima en vivo |

---

## 7. Estructura del Repositorio

```
grupo3-trafico-lima-smartcity-bd/
├── README.md
├── notebooks/
│   ├── 01_EDA_trafico_lima.ipynb
│   ├── 02_grafo_calles_spark.ipynb
│   ├── 03_neo4j_rutas.ipynb
│   ├── 04_spark_sql_patrones.ipynb
│   ├── 05_modelo_congestion.ipynb
│   ├── 06_scraping_eventos.ipynb
│   └── 07_dashboard_mapa.ipynb
├── src/
│   ├── simulador_gps.py             ← genera trayectorias 50K vehículos
│   ├── grafo_osm_lima.py            ← descarga y procesa OSM
│   ├── pipeline_trafico.py
│   └── predictor_congestion.py
├── data/
│   ├── README_datos.md
│   └── sample/
├── docs/
│   ├── arquitectura_smartcity.png
│   ├── presentacion_EP_semana4.pdf
│   └── presentacion_EF_semana8.pdf
├── .gitignore
└── requirements.txt
```

---

## 8. Cómo Usar Este Repositorio

```bash
git clone https://github.com/TU-USUARIO/grupo3-trafico-lima-smartcity-bd.git
cd grupo3-trafico-lima-smartcity-bd
git remote add upstream https://github.com/LIDER-GRUPO/grupo3-trafico-lima-smartcity-bd.git

# Cada semana
git checkout main && git pull upstream main
git checkout -b feature/grafo-neo4j-tuapellido
git add . && git commit -m "feat: implementar grafo Lima en Neo4j - TuApellido"
git push origin feature/grafo-neo4j-tuapellido
# → PR en GitHub → líder aprueba → merge
```

---

## 9. Recursos y Referencias

### Datos abiertos
- [OpenStreetMap Perú](https://download.geofabrik.de/south-america/peru.html)
- [SENAMHI API — Datos Climáticos](https://www.senamhi.gob.pe/main.php?dp=lima&p=datos-online)
- [Lima Cómo Vamos — Datos de Transporte](http://www.limacomovamos.org/)

### Repositorios GitHub similares
- [OSMnx — Street Network Analysis](https://github.com/gboeing/osmnx)
- [PySpark Graph Processing](https://github.com/graphframes/graphframes)
- [Neo4j Graph Data Science](https://github.com/neo4j/graph-data-science)
- [Kepler.gl — Mapas de Tráfico](https://github.com/keplergl/kepler.gl)
- [Traffic Prediction with ML](https://github.com/liyaguang/DCRNN)
- [Folium Maps Python](https://github.com/python-visualization/folium)

### Papers para artículo Scopus
- Lv et al. (2015) — "Traffic Flow Prediction with Big Data: A Deep Learning Approach" — IEEE TITS (Q1)
- Pan et al. (2019) — "Urban Traffic Prediction from Spatio-Temporal Data Using Deep Meta Learning" — KDD 2019
- Zhang et al. (2020) — "Graph Deep Learning Model for Network-based Predictive Hotspot Mapping" — ISPRS

---

## 10. Tracker de Progreso

| Semana | Entregable | Estado |
|--------|-----------|--------|
| S1 | Dataset GPS + EDA | ⬜ Pendiente |
| S2 | Grafo PySpark + GraphX | ⬜ Pendiente |
| S3 | Neo4j + Rutas | ⬜ Pendiente |
| S4 | **Sustentación EP** | ⬜ Pendiente |
| S5 | Spark SQL Patrones | ⬜ Pendiente |
| S6 | Modelo Predicción | ⬜ Pendiente |
| S7 | Scraping Eventos | ⬜ Pendiente |
| S8 | **Sustentación EF** | ⬜ Pendiente |

---

*Big Data DD283 | Universidad Autónoma del Perú | 2026-1*
