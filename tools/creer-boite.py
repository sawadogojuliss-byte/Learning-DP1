#!/usr/bin/env python3
"""Crée le coffre partagé Aide / Feedback, sans afficher son adresse."""

import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request

DEST = pathlib.Path('data/boite-url.json')
STATUT = pathlib.Path('data/boite-statut.txt')
EMAIL = '234701558+sawadogojuliss-byte@users.noreply.github.com'
NOTES = []


def noter(texte):
    propre = re.sub(r'https?://\S+', '[url]', str(texte))
    NOTES.append(propre[:220])
    print(propre[:220])


def lire():
    if not DEST.exists():
        return {'sujet': 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b', 'kvdb': '', 'archive': ''}
    data = json.loads(DEST.read_text(encoding='utf-8'))
    data.setdefault('sujet', 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b')
    data.setdefault('kvdb', '')
    data.setdefault('archive', '')
    return data


def ouvrir(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=40) as res:
        return res.status, res.headers, res.read()


def creer_kvdb():
    body = urllib.parse.urlencode({'email': EMAIL, 'default_ttl': '604800'}).encode()
    try:
        status, _headers, raw = ouvrir('https://kvdb.io', data=body, method='POST')
    except Exception as exc:
        noter('kvdb indisponible ' + type(exc).__name__)
        return ''
    bucket = raw.decode('utf-8', 'replace').strip()
    if status >= 400 or not bucket or '/' in bucket or len(bucket) > 80 or ' ' in bucket:
        noter('kvdb reponse inattendue')
        return ''
    url = 'https://kvdb.io/' + bucket
    probe = url + '/probe_boot?ttl=60'
    try:
        ouvrir(probe, data=b'ok', method='POST')
        _status, _headers, got = ouvrir(url + '/probe_boot')
        if got.decode('utf-8', 'replace').strip() != 'ok':
            noter('kvdb illisible')
            return ''
        try:
            ouvrir(url + '/probe_boot', method='DELETE')
        except Exception:
            pass
    except Exception as exc:
        noter('kvdb ecriture impossible ' + type(exc).__name__)
        return ''
    noter('kvdb pret')
    return url


def creer_archive():
    payload = json.dumps({'questions': [], 'feedbacks': [], 'emplois': []}).encode()
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    try:
        _status, hdrs, raw = ouvrir(
            'https://api.jsonstorage.net/v1/json',
            data=payload,
            headers=headers,
            method='POST',
        )
    except Exception as exc:
        noter('archive indisponible ' + type(exc).__name__)
        return ''
    uri = ''
    try:
        data = json.loads(raw.decode('utf-8', 'replace'))
        if isinstance(data, dict):
            uri = data.get('uri') or data.get('url') or ''
            if not uri and isinstance(data.get('data'), dict):
                uri = data['data'].get('uri') or data['data'].get('url') or ''
    except Exception:
        uri = ''
    uri = (uri or hdrs.get('Location') or '').strip()
    if uri.startswith('/'):
        uri = 'https://api.jsonstorage.net' + uri
    if not uri.startswith('https://'):
        noter('archive sans adresse')
        return ''
    vide = json.dumps({'questions': [], 'feedbacks': [], 'emplois': []}).encode()
    try:
        ouvrir(uri, data=vide, headers={'Content-Type': 'application/json'}, method='PUT')
        _status, _headers, got = ouvrir(uri)
        json.loads(got.decode('utf-8', 'replace'))
    except Exception as exc:
        noter('archive illisible ' + type(exc).__name__)
        return ''
    noter('archive prete')
    return uri


def main():
    data = lire()
    if not data.get('kvdb'):
        data['kvdb'] = creer_kvdb()
    if not data.get('archive'):
        data['archive'] = creer_archive()
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps({
        'sujet': data.get('sujet') or 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b',
        'kvdb': data.get('kvdb') or '',
        'archive': data.get('archive') or '',
    }, indent=2) + '\n', encoding='utf-8')
    STATUT.write_text('\n'.join(NOTES) + '\n', encoding='utf-8')
    if not data.get('kvdb') and not data.get('archive'):
        noter('aucun coffre')
        STATUT.write_text('\n'.join(NOTES) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
