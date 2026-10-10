#!/usr/bin/env python3
"""Affiche les dernières questions et réponses reçues, sans leur texte long."""

import json
import urllib.request

SUJET = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b'


def main():
    url = 'https://ntfy.sh/' + SUJET + '/json?poll=1&since=all'
    with urllib.request.urlopen(url, timeout=40) as res:
        brut = res.read().decode('utf-8', 'replace')
    lignes = [ligne for ligne in brut.splitlines() if ligne.strip()]
    print('lignes', len(lignes))
    utiles = []
    for ligne in lignes:
        try:
            enveloppe = json.loads(ligne)
        except Exception:
            continue
        corps = enveloppe.get('message') or ''
        try:
            item = json.loads(corps)
        except Exception:
            continue
        if not isinstance(item, dict):
            continue
        if item.get('type') not in ('question', 'reponse', 'feedback'):
            continue
        utiles.append(item)
    print('utiles', len(utiles))
    for item in utiles[-12:]:
        print(json.dumps({
            'type': item.get('type'),
            'at': item.get('at'),
            'nom': item.get('nom'),
            'email': item.get('email'),
            'google': item.get('google'),
            'destinataire': item.get('destinataire'),
            'mail': item.get('mail'),
            'questionId': item.get('questionId'),
            'texte': str(item.get('texte') or '')[:80],
        }, ensure_ascii=False))


if __name__ == '__main__':
    main()
