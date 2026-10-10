#!/usr/bin/env python3
"""Vérifie qu'une réponse part vers une nouvelle boîte, sans nouvelle activation."""

import json
import time
import urllib.parse
import urllib.request

PROPRIO = 'proprio1791644730@maxxspace.com'
MARQUE = 'REPONSE-STUDYPLAN-' + str(int(time.time()))
SITE = {
    'User-Agent': 'Mozilla/5.0',
    'Origin': 'https://sawadogojuliss-byte.github.io',
    'Referer': 'https://sawadogojuliss-byte.github.io/',
}


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read()


def creer_boite():
    _status, raw = ouvrir('https://api.mail.tm/domains')
    domaine = json.loads(raw.decode())['hydra:member'][0]['domain']
    adresse = 'eleve' + str(int(time.time())) + '@' + domaine
    secret = 'Verification-' + str(int(time.time()))
    ouvrir('https://api.mail.tm/accounts', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    _status, raw = ouvrir('https://api.mail.tm/token', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return adresse, json.loads(raw.decode())['token']


def corps_message(jeton, ident):
    _status, raw = ouvrir('https://api.mail.tm/messages/' + ident, headers={'Authorization': 'Bearer ' + jeton})
    data = json.loads(raw.decode())
    html = data.get('html') or ''
    if isinstance(html, list):
        html = '\n'.join(html)
    return '\n'.join([str(data.get('subject') or ''), str(data.get('text') or ''), str(html)])


def main():
    eleve, jeton = creer_boite()
    print('eleve', eleve)
    message = MARQUE + '\n\n—\nTa question :\nQuestion de verification\n\n— Study Plan IB'
    payload = {
        'name': 'Study Plan IB',
        'email': eleve,
        '_replyto': 'ibstudyplan@gmail.com',
        '_subject': 'Réponse à ta question — Study Plan IB',
        '_cc': eleve,
        '_captcha': 'false',
        '_template': 'box',
        'message': message,
    }
    status, raw = ouvrir(
        'https://formsubmit.co/ajax/' + urllib.parse.quote(PROPRIO),
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', **SITE},
        method='POST'
    )
    print('envoi', status, raw.decode('utf-8', 'replace')[:300])
    fin = time.time() + 70
    while time.time() < fin:
        time.sleep(6)
        _status, raw = ouvrir('https://api.mail.tm/messages', headers={'Authorization': 'Bearer ' + jeton})
        membres = json.loads(raw.decode()).get('hydra:member') or []
        print('messages', len(membres))
        for item in membres:
            detail = corps_message(jeton, item['id'])
            if MARQUE in detail:
                print('livre')
                return
            print('sujet', item.get('subject'))
    raise SystemExit('pas_livre')


if __name__ == '__main__':
    main()
