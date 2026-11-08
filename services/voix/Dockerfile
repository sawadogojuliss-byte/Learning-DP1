FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home voix
WORKDIR /app
COPY services/voix/serveur.py services/voix/serveur.py
COPY tools/preparer-annonces-fluides.py tools/preparer-annonces-fluides.py
COPY livrables/stock-voix/messages/ livrables/stock-voix/messages/
COPY livrables/stock-voix/durees/ livrables/stock-voix/durees/
COPY livrables/publication-voix/essai-*-minutes.mp3 livrables/publication-voix/
USER voix
ENV PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python3", "services/voix/serveur.py"]
