#!/usr/bin/env python3
"""Sonde les points d'accès de l'assistant exactement comme le navigateur le fait.

Le site appelle les modèles en JavaScript depuis une page github.io. Le navigateur
envoie donc un contrôle CORS (requête OPTIONS) avant la vraie requête POST, parce
que l'appel contient un en-tête Authorization et du JSON. Si le contrôle échoue,
la requête n'est jamais envoyée : l'assistant retombe sur ses réponses locales.

Cette sonde vérifie, pour chaque service :
  1. le contrôle CORS (OPTIONS) avec l'origine du site ;
  2. la vraie requête (POST ou GET), avec l'origine du site ;
  3. l'en-tête access-control-allow-origin de la réponse ;
  4. un extrait de la réponse, pour voir si un texte est bien renvoyé.
"""

import json
import subprocess
import sys

ORIGINE = "https://sawadogojuliss-byte.github.io"
LLM7 = "https://api.llm7.io/v1/chat/completions"
POLLI = "https://text.pollinations.ai/"
CORPS = {
    "model": "default",
    "messages": [{"role": "user", "content": "Réponds en trois mots : bonjour, ça va ?"}],
    "max_tokens": 40,
    "stream": False,
}


def curl(args, timeout=45):
    proc = subprocess.run(["curl", "-sS", "--max-time", str(timeout)] + args,
                          capture_output=True, text=True)
    return proc.stdout, proc.stderr, proc.returncode


def entetes(bloc):
    """Renvoie les en-têtes d'un bloc d'écriture curl -D -."""
    trouve = {}
    for ligne in (bloc or "").splitlines():
        if ":" not in ligne:
            continue
        cle, valeur = ligne.split(":", 1)
        trouve[cle.strip().lower()] = valeur.strip()
    return trouve


def bloc(entete, nom, resultat):
    print("\n=== " + nom + " ===")
    print(resultat)


def essai_llm7(modele):
    corps = dict(CORPS)
    corps["model"] = modele
    with open("/tmp/corps.json", "w", encoding="utf-8") as f:
        json.dump(corps, f, ensure_ascii=False)
    sortie, err, code = curl([
        "-D", "/tmp/e.txt", "-o", "/tmp/c.txt",
        "-X", "POST", LLM7,
        "-H", "Content-Type: application/json",
        "-H", "Authorization: Bearer unused",
        "-H", "Origin: " + ORIGINE,
        "--data-binary", "@/tmp/corps.json",
        "-w", "%{http_code}",
    ])
    entetes_c = open("/tmp/e.txt", encoding="utf-8", errors="replace").read()
    try:
        corps_rep = open("/tmp/c.txt", encoding="utf-8", errors="replace").read()[:400]
    except OSError:
        corps_rep = ""
    bloc("llm7 " + modele, modele, "code http : " + sortie
         + "\naccess-control-allow-origin : " + entetes(entetes_c).get("access-control-allow-origin", "ABSENT")
         + "\nréponse : " + " ".join(corps_rep.split())[:300])


def essai_preflight():
    sortie, err, code = curl([
        "-D", "-", "-o", "/dev/null",
        "-X", "OPTIONS", LLM7,
        "-H", "Origin: " + ORIGINE,
        "-H", "Access-Control-Request-Method: POST",
        "-H", "Access-Control-Request-Headers: content-type,authorization",
    ])
    entetes_c = sortie
    print("\n=== contrôle CORS de llm7 (OPTIONS) ===")
    print("allow-origin : " + entetes(entetes_c).get("access-control-allow-origin", "ABSENT"))
    print("allow-headers : " + entetes(entetes_c).get("access-control-allow-headers", "ABSENT"))
    print("allow-methods : " + entetes(entetes_c).get("access-control-allow-methods", "ABSENT"))
    print("code : " + entetes(entetes_c).get("_code", "") + err.strip()[:200])


def essai_pollinations():
    sortie, err, code = curl([
        "-D", "/tmp/e2.txt", "-o", "/tmp/c2.txt",
        "-H", "Origin: " + ORIGINE,
        POLLI + "Reponds en trois mots: bonjour ca va",
        "-w", "%{http_code}",
    ])
    entetes_c = open("/tmp/e2.txt", encoding="utf-8", errors="replace").read()
    try:
        corps_rep = open("/tmp/c2.txt", encoding="utf-8", errors="replace").read()[:400]
    except OSError:
        corps_rep = ""
    print("\n=== pollinations (secours) ===")
    print("code http : " + sortie)
    print("access-control-allow-origin : " + entetes(entetes_c).get("access-control-allow-origin", "ABSENT"))
    print("réponse : " + " ".join(corps_rep.split())[:300])


def main():
    print("origine testée : " + ORIGINE)
    essai_preflight()
    for modele in ["default", "fast", "gpt-4o-mini", "DeepSeek-V4-Flash-0731", "llama-3.3-70b-instruct"]:
        essai_llm7(modele)
    essai_pollinations()
    return 0


if __name__ == "__main__":
    sys.exit(main())
