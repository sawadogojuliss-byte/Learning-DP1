#!/usr/bin/env python3
"""Vérifie la version 2 du script, puis qu'une lettre arrive."""

import json
import time
import urllib.error
import urllib.request

SCRIPT = 'https://script.google.com/macros/s/AKfycbxhDi6E6ebNBrkAaKNIVXSeySUT6p1H7kG5X8l85FVArw8Yv5uRuOsWrdEFMYXzxxSDQA/exec'
SECRET = 'spib-7c4e9a2b8d1f6c3e'
SUJET = 'Réponse à ta question — Study Plan IB'
MARQUE = 'LETTRE-V2-' + str(int(time.time()))


def ouvrir(url, data=None, headers=None, method=None, timeout=45):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


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


def detail(jeton, ident):
    _status, raw = ouvrir('https://api.mail.tm/messages/' + ident, headers={'Authorization': 'Bearer ' + jeton})
    data = json.loads(raw.decode())
    html = data.get('html') or ''
    if isinstance(html, list):
        html = '\n'.join(str(part) for part in html)
    return data, '\n'.join([str(data.get('subject') or ''), str(data.get('text') or ''), str(html)])


def main():
    status, raw = ouvrir(SCRIPT)
    corps = raw.decode('utf-8', 'replace')
    print('version', status, corps[:240])
    if '"version":2' not in corps.replace(' ', ''):
        raise SystemExit('pas_version_2')
    eleve, jeton = creer_boite()
    print('eleve', eleve)
    nonce = 'lettre' + str(int(time.time())) + 'abcdef'
    texte = "Bonjour,\n\n" + MARQUE + "\n\nÀ bientôt,\nL'équipe Study Plan IB"
    html = '<p>Bonjour,</p><p>' + MARQUE + '</p><p>À bientôt,<br><strong>L\'équipe Study Plan IB</strong></p>'
    payload = json.dumps({
        'secret': SECRET,
        'nonce': nonce,
        'to': eleve,
        'replyTo': 'ibstudyplan@gmail.com',
        'subject': SUJET,
        'text': texte,
        'html': html,
    }).encode()
    status, raw = ouvrir(SCRIPT, data=payload, headers={'Content-Type': 'text/plain;charset=utf-8'}, method='POST')
    corps = raw.decode('utf-8', 'replace')
    print('envoi', status, corps[:300])
    if nonce not in corps:
        raise SystemExit('nonce_absent')
    fin = time.time() + 90
    while time.time() < fin:
        time.sleep(6)
        _status, raw = ouvrir('https://api.mail.tm/messages', headers={'Authorization': 'Bearer ' + jeton})
        membres = json.loads(raw.decode()).get('hydra:member') or []
        print('messages', len(membres))
        for item in membres:
            data, tout = detail(jeton, item['id'])
            if MARQUE not in tout:
                print('sujet', item.get('subject'))
                continue
            print('from', json.dumps(data.get('from'), ensure_ascii=False)[:240])
            bas = tout.lower()
            print('formsubmit', 'formsubmit' in bas or 'someone just submitted' in bas)
            print('alerte', 'alerte de sécurité' in bas or 'security alert' in bas)
            print('livre')
            return
    raise SystemExit('pas_livre')


if __name__ == '__main__':
    main()
