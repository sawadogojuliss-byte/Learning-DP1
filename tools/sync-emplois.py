#!/usr/bin/env python3
"""Rassemble les emplois du temps dans data/emplois.json.

Les navigateurs envoient chaque inscription vers ntfy et, si possible, vers
un coffre kvdb. Ce script est le backend durable : il relit ces sources et
garde la dernière fiche de chaque appareil, avec le compte Google s'il a
été ajouté plus tard.
"""

import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request

DEST_URL = pathlib.Path('data/boite-url.json')
DEST_EMPLOIS = pathlib.Path('data/emplois.json')
SUJET = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b'
EMAIL = '234701558+sawadogojuliss-byte@users.noreply.github.com'


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read()


def lire_json(path, defaut):
    if not path.exists():
        return defaut
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return defaut


def ecrire(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def parser(texte):
    try:
        data = json.loads(texte)
    except Exception:
        return None
    return data if isinstance(data, dict) and data.get('type') else None


def lire_ntfy(sujet):
    url = 'https://ntfy.sh/' + urllib.parse.quote(sujet) + '/json?poll=1&since=48h'
    try:
        _status, raw = ouvrir(url, headers={'Accept': 'application/x-ndjson'})
    except Exception as exc:
        print('ntfy indisponible', type(exc).__name__)
        return []
    out = []
    for ligne in raw.decode('utf-8', 'replace').splitlines():
        if not ligne.strip():
            continue
        try:
            enveloppe = json.loads(ligne)
        except Exception:
            continue
        if enveloppe.get('event') and enveloppe.get('event') != 'message':
            continue
        data = parser(enveloppe.get('message') or '')
        if data:
            out.append(data)
    print('ntfy', len(out))
    return out


def creer_kvdb():
    body = urllib.parse.urlencode({'email': EMAIL, 'default_ttl': '31536000'}).encode()
    try:
        _status, raw = ouvrir('https://kvdb.io', data=body, method='POST')
    except Exception as exc:
        print('kvdb creation impossible', type(exc).__name__)
        return ''
    bucket = raw.decode('utf-8', 'replace').strip()
    if bucket.startswith('{'):
        try:
            data = json.loads(bucket)
            bucket = str(data.get('id') or data.get('bucket') or '')
        except Exception:
            bucket = ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}', bucket):
        print('kvdb reponse inattendue')
        return ''
    url = 'https://kvdb.io/' + bucket
    try:
        ouvrir(url + '/probe_sync?ttl=60', data=b'ok', method='POST')
        _status, got = ouvrir(url + '/probe_sync')
        if got.decode('utf-8', 'replace').strip() != 'ok':
            print('kvdb illisible')
            return ''
    except Exception as exc:
        print('kvdb ecriture impossible', type(exc).__name__)
        return ''
    print('kvdb pret')
    return url


def lire_kvdb(url):
    if not url:
        return []
    try:
        _status, raw = ouvrir(url.rstrip('/') + '/?values=true&format=json&limit=2000')
        lignes = json.loads(raw.decode('utf-8', 'replace'))
    except Exception as exc:
        print('kvdb lecture impossible', type(exc).__name__)
        return []
    out = []
    for ligne in lignes if isinstance(lignes, list) else []:
        valeur = ligne[1] if isinstance(ligne, list) and len(ligne) > 1 else ligne
        if isinstance(valeur, str):
            valeur = parser(valeur)
        if isinstance(valeur, dict) and valeur.get('type'):
            out.append(valeur)
    print('kvdb', len(out))
    return out


def creer_archive():
    payload = json.dumps({'questions': [], 'feedbacks': [], 'emplois': [], 'reponses': []}).encode()
    try:
        _status, raw = ouvrir(
            'https://api.jsonstorage.net/v1/json',
            data=payload,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )
    except Exception as exc:
        print('archive indisponible', type(exc).__name__)
        return ''
    uri = ''
    try:
        data = json.loads(raw.decode('utf-8', 'replace'))
        if isinstance(data, dict):
            uri = data.get('uri') or data.get('url') or ''
    except Exception:
        uri = ''
    if uri.startswith('/'):
        uri = 'https://api.jsonstorage.net' + uri
    if not uri.startswith('https://'):
        print('archive sans adresse')
        return ''
    print('archive prete')
    return uri


def lire_archive(url):
    if not url:
        return []
    try:
        _status, raw = ouvrir(url)
        doc = json.loads(raw.decode('utf-8', 'replace'))
    except Exception as exc:
        print('archive illisible', type(exc).__name__)
        return []
    if not isinstance(doc, dict):
        return []
    return [item for item in (doc.get('emplois') or []) if isinstance(item, dict)]


def completer(ancien, nouveau):
    if not ancien:
        return nouveau
    for champ in ('google', 'googleSub', 'googleNom', 'email'):
        if not nouveau.get(champ) and ancien.get(champ):
            nouveau[champ] = ancien[champ]
    if not nouveau.get('jours') and ancien.get('jours'):
        nouveau['jours'] = ancien['jours']
    if not nouveau.get('matieres') and ancien.get('matieres'):
        nouveau['matieres'] = ancien['matieres']
    if not nouveau.get('classe') and ancien.get('classe'):
        nouveau['classe'] = ancien['classe']
    if not nouveau.get('nom') and ancien.get('nom'):
        nouveau['nom'] = ancien['nom']
    return nouveau


def fusionner(items):
    emplois = {}
    for item in items:
        if not isinstance(item, dict) or item.get('type') != 'emploi':
            continue
        cle = str(item.get('appareil') or item.get('id') or '')
        if not cle:
            continue
        deja = emplois.get(cle)
        if not deja or str(item.get('at') or '') >= str(deja.get('at') or ''):
            emplois[cle] = completer(deja, dict(item))
        else:
            emplois[cle] = completer(item, deja)
    liste = list(emplois.values())
    liste.sort(key=lambda item: str(item.get('nom') or '').lower())
    return liste[:300]


def leger(item):
    return {
        'type': 'emploi',
        'id': item.get('id') or '',
        'appareil': item.get('appareil') or '',
        'at': item.get('at') or '',
        'nom': item.get('nom') or '',
        'classe': item.get('classe') or '',
        'email': item.get('email') or '',
        'google': item.get('google') or '',
        'googleNom': item.get('googleNom') or '',
        'googleSub': item.get('googleSub') or '',
        'matieres': item.get('matieres') or [],
        'jours': item.get('jours') or [],
    }


def main():
    config = lire_json(DEST_URL, {'sujet': SUJET, 'kvdb': '', 'archive': ''})
    config.setdefault('sujet', SUJET)
    if not config.get('kvdb'):
        config['kvdb'] = creer_kvdb()
    if not config.get('archive'):
        config['archive'] = creer_archive()
    ecrire(DEST_URL, {
        'sujet': config.get('sujet') or SUJET,
        'kvdb': config.get('kvdb') or '',
        'archive': config.get('archive') or '',
    })
    existants = lire_json(DEST_EMPLOIS, {}).get('emplois') or []
    items = list(existants) + lire_ntfy(config.get('sujet') or SUJET)
    items.extend(lire_kvdb(config.get('kvdb') or ''))
    items.extend(lire_archive(config.get('archive') or ''))
    emplois = [leger(item) for item in fusionner(items)]
    ecrire(DEST_EMPLOIS, {'emplois': emplois})
    print('emplois', len(emplois))


if __name__ == '__main__':
    main()
