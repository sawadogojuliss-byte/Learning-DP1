#!/usr/bin/env python3
"""Envoie le même appel que la page des retours, puis vérifie que le texte arrive."""

import json
import time
import urllib.error
import urllib.parse
import urllib.request

EXPEDITEUR = 'ibstudyplan@gmail.com'
SUJET = 'Réponse à ta question — Study Plan IB'
MARQUE = 'REPONSE-STUDYPLAN-' + str(int(time.time()))
CORPS = MARQUE + '\n\n—\nTa question :\nQuestion de vérification\n\n— Study Plan IB'


def ouvrir(url, data=None, headers=None, method=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read()


def poster(url, data, headers):
    try:
        status, raw = ouvrir(url, data=data, headers=headers, method='POST')
        return status, raw.decode('utf-8', 'replace')
    except urllib.error.HTTPError as exc:
        corps = ''
        try:
            corps = exc.read().decode('utf-8', 'replace')
        except Exception:
            corps = ''
        return exc.code, corps


def boite(adresse):
    payload = {
        'name': 'Study Plan IB',
        'email': EXPEDITEUR,
        '_replyto': EXPEDITEUR,
        '_subject': SUJET,
        '_template': 'box',
        '_captcha': 'false',
        'message': CORPS,
    }
    entetes = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Origin': 'https://sawadogojuliss-byte.github.io',
        'Referer': 'https://sawadogojuliss-byte.github.io/',
    }
    status_n, texte_n = poster(
        'https://ntfy.sh/ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b',
        CORPS.encode('utf-8'),
        {
            'Email': adresse,
            'Title': 'Reponse Study Plan IB',
            'Content-Type': 'text/plain; charset=utf-8',
            'User-Agent': 'StudyPlanIB',
        }
    )
    print('ntfy', status_n, texte_n[:500])
    return status_n, texte_n


def creer_boite():
    status, raw = ouvrir('https://api.mail.tm/domains')
    domaines = json.loads(raw.decode()).get('hydra:member') or []
    if not domaines:
        raise SystemExit('aucun domaine temporaire')
    domaine = domaines[0]['domain']
    adresse = 'spib' + str(int(time.time())) + '@' + domaine
    secret = 'Verification-' + str(int(time.time()))
    ouvrir('https://api.mail.tm/accounts', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    status, raw = ouvrir('https://api.mail.tm/token', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    jeton = json.loads(raw.decode()).get('token') or ''
    if not jeton:
        raise SystemExit('jeton temporaire absent')
    return adresse, jeton


def lire(jeton):
    status, raw = ouvrir('https://api.mail.tm/messages', headers={'Authorization': 'Bearer ' + jeton})
    return json.loads(raw.decode())


def main():
    adresse, jeton = creer_boite()
    print('destinataire', adresse)
    try:
        boite(adresse)
    except Exception as exc:
        print('envoi', type(exc).__name__, exc)
        raise SystemExit(1)
    fin = time.time() + 90
    while time.time() < fin:
        time.sleep(8)
        try:
            messages = lire(jeton)
        except Exception as exc:
            print('lecture', type(exc).__name__)
            continue
        membres = messages.get('hydra:member') or []
        print('messages', len(membres))
        for item in membres:
            intro = str(item.get('intro') or '') + ' ' + str(item.get('subject') or '')
            print('recu', item.get('subject'), intro[:180])
            if MARQUE in intro or MARQUE in str(item):
                print('livre')
                return
            ident = item.get('id')
            if not ident:
                continue
            try:
                status, raw = ouvrir('https://api.mail.tm/messages/' + ident, headers={'Authorization': 'Bearer ' + jeton})
            except Exception:
                continue
            detail = raw.decode('utf-8', 'replace')
            if MARQUE in detail:
                print('livre')
                return
            print('contenu', detail[:240])
    raise SystemExit('le message n’est pas arrivé')


if __name__ == '__main__':
    main()
