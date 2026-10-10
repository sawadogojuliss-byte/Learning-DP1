#!/usr/bin/env python3
"""Vérifie qu'une lettre Study Plan IB arrive, sans le modèle FormSubmit."""

import json
import time
import urllib.error
import urllib.request

SCRIPT = 'https://script.google.com/macros/s/AKfycbz_rykUE5HgUg5fCh_p9FBwptfbSAMGfc3fw7jMR-u3JhcYYldkHG1iPqleF9XiHlgMfQ/exec'
SECRET = 'spib-7c4e9a2b8d1f6c3e'
SUJET = 'Réponse à ta question — Study Plan IB'
MARQUE = 'LETTRE-STUDYPLAN-' + str(int(time.time()))


def ouvrir(url, data=None, headers=None, method=None, timeout=45):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read(), dict(res.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), dict(exc.headers)


def creer_boite():
    _status, raw, _headers = ouvrir('https://api.mail.tm/domains')
    domaine = json.loads(raw.decode())['hydra:member'][0]['domain']
    adresse = 'eleve' + str(int(time.time())) + '@' + domaine
    secret = 'Verification-' + str(int(time.time()))
    ouvrir('https://api.mail.tm/accounts', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    _status, raw, _headers = ouvrir('https://api.mail.tm/token', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return adresse, json.loads(raw.decode())['token']


def detail(jeton, ident):
    _status, raw, _headers = ouvrir(
        'https://api.mail.tm/messages/' + ident,
        headers={'Authorization': 'Bearer ' + jeton}
    )
    data = json.loads(raw.decode())
    html = data.get('html') or ''
    if isinstance(html, list):
        html = '\n'.join(str(part) for part in html)
    return data, '\n'.join([
        str(data.get('subject') or ''),
        str(data.get('intro') or ''),
        str(data.get('text') or ''),
        str(html)
    ])


def lettre(message, question):
    texte = 'Bonjour,\n\n' + message + '\n\nTa question :\n' + question + '\n\nÀ bientôt,\nL\'équipe Study Plan IB'
    html = (
        '<div>Réponse de l\'équipe Study Plan IB</div>'
        '<p>Bonjour,</p><p>' + message + '</p>'
        '<p>Ta question</p><p>' + question + '</p>'
        '<p>À bientôt,</p><p>L\'équipe Study Plan IB</p>'
    )
    return texte, html


def main():
    eleve, jeton = creer_boite()
    print('eleve', eleve)
    texte, html = lettre(MARQUE, 'Question de verification')
    payload = json.dumps({
        'secret': SECRET,
        'to': eleve,
        'replyTo': 'ibstudyplan@gmail.com',
        'subject': SUJET,
        'text': texte,
        'html': html,
    }).encode()
    status, raw, headers = ouvrir(
        SCRIPT,
        data=payload,
        headers={
            'Content-Type': 'text/plain;charset=utf-8',
            'Origin': 'https://sawadogojuliss-byte.github.io',
            'Referer': 'https://sawadogojuliss-byte.github.io/',
        },
        method='POST'
    )
    corps = raw.decode('utf-8', 'replace')
    print('envoi', status, corps[:400])
    print('acao', headers.get('Access-Control-Allow-Origin') or headers.get('access-control-allow-origin') or '')
    if '"success":true' not in corps.replace(' ', '') and '"success": true' not in corps:
        raise SystemExit('envoi_refuse')
    fin = time.time() + 90
    while time.time() < fin:
        time.sleep(6)
        _status, raw, _headers = ouvrir(
            'https://api.mail.tm/messages',
            headers={'Authorization': 'Bearer ' + jeton}
        )
        membres = json.loads(raw.decode()).get('hydra:member') or []
        print('messages', len(membres))
        for item in membres:
            data, tout = detail(jeton, item['id'])
            if MARQUE not in tout:
                print('sujet', item.get('subject'))
                continue
            print('from', json.dumps(data.get('from'), ensure_ascii=False)[:240])
            print('sujet_recu', data.get('subject'))
            bas = tout.lower()
            print('formsubmit', 'formsubmit' in bas or 'someone just submitted' in bas)
            print('equipe', "L'équipe Study Plan IB" in tout)
            print('livre')
            return
    raise SystemExit('pas_livre')


if __name__ == '__main__':
    main()
