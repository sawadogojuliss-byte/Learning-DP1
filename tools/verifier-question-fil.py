#!/usr/bin/env python3
"""Vérifie que le fil de la boîte accepte les envois du navigateur.

Le site publie questions et suggestions par un POST vers ntfy.sh avec des
en-têtes précis (texte brut, titre, priorité minimale). Ce test refait
exactement ce POST — une « sonde », que la boîte et la synchronisation
ignorent — puis relit le fil. Si le service refuse le message ou le perd,
l'envoi de questions est cassé : le commit passe en rouge.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request

SUJET = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b'


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read()


def main():
    sonde = {
        'type': 'sonde',
        'id': 'sonde-%d' % int(time.time() * 1000),
        'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'texte': 'sonde automatique, à ignorer'
    }
    corps = json.dumps(sonde, ensure_ascii=False).encode('utf-8')
    statut, brut = ouvrir(
        'https://ntfy.sh/' + urllib.parse.quote(SUJET),
        data=corps,
        method='POST',
        headers={'Content-Type': 'text/plain', 'Title': 'sonde', 'Priority': 'min'}
    )
    print('post', statut, brut[:120])
    if statut != 200:
        raise SystemExit('refuse')

    time.sleep(4)
    _statut, brut = ouvrir(
        'https://ntfy.sh/' + urllib.parse.quote(SUJET) + '/json?poll=1&since=15m',
        headers={'Accept': 'application/x-ndjson'}
    )
    for ligne in brut.decode('utf-8', 'replace').splitlines():
        if not ligne.strip():
            continue
        try:
            enveloppe = json.loads(ligne)
        except Exception:
            continue
        try:
            item = json.loads(enveloppe.get('message') or '')
        except Exception:
            continue
        if isinstance(item, dict) and item.get('id') == sonde['id']:
            print('sonde lue dans le fil : l’envoi de questions passe')
            return
    raise SystemExit('sonde_perdue')


if __name__ == '__main__':
    main()
