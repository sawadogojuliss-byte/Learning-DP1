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
    propre = re.sub(r'\b[A-Za-z0-9_-]{12,}\b', '[id]', propre)
    NOTES.append(propre[:240])
    print(propre[:240])


def detail(exc):
    code = getattr(exc, 'code', '')
    corps = ''
    try:
        corps = exc.read().decode('utf-8', 'replace')[:120]
    except Exception:
        corps = ''
    return type(exc).__name__ + ' ' + str(code) + ' ' + corps


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
    body = urllib.parse.urlencode({'email': EMAIL, 'default_ttl': '31536000'}).encode()
    try:
        status, _headers, raw = ouvrir('https://kvdb.io', data=body, method='POST')
    except Exception as exc:
        noter('kvdb indisponible ' + detail(exc))
        return ''
    bucket = raw.decode('utf-8', 'replace').strip()
    noter('kvdb creation HTTP ' + str(status) + ' longueur ' + str(len(bucket)))
    if bucket.startswith('{'):
        try:
            data = json.loads(bucket)
            bucket = str(data.get('id') or data.get('bucket') or data.get('bucket_id') or '')
        except Exception:
            bucket = ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}', bucket):
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
        noter('kvdb ecriture impossible ' + detail(exc))
        return ''
    noter('kvdb pret')
    return url


def seed_archive():
    path = pathlib.Path('data/emplois.json')
    emplois = []
    if path.exists():
        try:
            doc = json.loads(path.read_text(encoding='utf-8'))
            emplois = doc.get('emplois') or []
        except Exception:
            emplois = []
    return {'questions': [], 'feedbacks': [], 'reponses': [], 'emplois': emplois}


def creer_jsonblob():
    payload = json.dumps(seed_archive(), ensure_ascii=False).encode('utf-8')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    try:
        status, hdrs, _raw = ouvrir(
            'https://jsonblob.com/api/jsonBlob',
            data=payload,
            headers=headers,
            method='POST',
        )
    except Exception as exc:
        noter('jsonblob indisponible ' + detail(exc))
        return ''
    noter('jsonblob creation HTTP ' + str(status))
    uri = (hdrs.get('Location') or hdrs.get('location') or '').strip()
    blob = (hdrs.get('X-jsonblob') or hdrs.get('x-jsonblob') or '').strip()
    if not uri and blob:
        uri = 'https://jsonblob.com/api/jsonBlob/' + blob
    if uri.startswith('/'):
        uri = 'https://jsonblob.com' + uri
    if not uri.startswith('https://jsonblob.com/api/jsonBlob/'):
        noter('jsonblob sans adresse')
        return ''
    try:
        _status, _headers, got = ouvrir(uri, headers={'Accept': 'application/json'})
        lu = json.loads(got.decode('utf-8', 'replace'))
        if not isinstance(lu, dict) or 'emplois' not in lu:
            noter('jsonblob inattendu')
            return ''
    except Exception as exc:
        noter('jsonblob illisible ' + detail(exc))
        return ''
    noter('jsonblob pret ' + str(len((lu.get('emplois') or []))) + ' emplois')
    return uri


def creer_archive():
    blob = creer_jsonblob()
    if blob:
        return blob
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
        noter('archive indisponible ' + detail(exc))
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
        noter('archive illisible ' + detail(exc))
        return ''
    noter('archive prete')
    return uri


def sonder_ntfy(sujet):
    try:
        status, _headers, raw = ouvrir(
            'https://ntfy.sh/' + sujet,
            data=b'{"type":"probe"}',
            headers={'Content-Type': 'text/plain', 'Priority': 'min', 'Title': 'probe'},
            method='POST',
        )
        noter('ntfy HTTP ' + str(status) + ' longueur ' + str(len(raw)))
    except Exception as exc:
        noter('ntfy indisponible ' + detail(exc))


def main():
    data = lire()
    sonder_ntfy(data.get('sujet') or 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b')
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
