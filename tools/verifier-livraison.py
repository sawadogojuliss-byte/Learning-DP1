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
    url = 'https://formsubmit.co/ajax/' + urllib.parse.quote(adresse)
    corps = json.dumps(payload).encode()
    status, raw = ouvrir(url, data=corps, headers={
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }, method='POST')
    texte = raw.decode('utf-8', 'replace')
    print('fournisseur', status, texte[:500])
    return status, texte


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
