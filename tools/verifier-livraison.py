#!/usr/bin/env python3
"""Trouve une boîte déjà activée, ou en active une, puis vérifie la livraison."""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

MARQUE = 'REPONSE-STUDYPLAN-' + str(int(time.time()))
SITE = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Origin': 'https://sawadogojuliss-byte.github.io',
    'Referer': 'https://sawadogojuliss-byte.github.io/',
}


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def creer_boite(prefix):
    _status, raw = ouvrir('https://api.mail.tm/domains')
    domaine = json.loads(raw.decode())['hydra:member'][0]['domain']
    adresse = prefix + str(int(time.time())) + '@' + domaine
    secret = 'Verification-' + prefix + str(int(time.time()))
    ouvrir('https://api.mail.tm/accounts', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    _status, raw = ouvrir('https://api.mail.tm/token', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return adresse, json.loads(raw.decode())['token']


def texte_message(jeton, ident):
    _status, raw = ouvrir('https://api.mail.tm/messages/' + ident, headers={'Authorization': 'Bearer ' + jeton})
    data = json.loads(raw.decode())
    html = data.get('html') or ''
    if isinstance(html, list):
        html = '\n'.join(str(part) for part in html)
    return '\n'.join([str(data.get('subject') or ''), str(data.get('text') or ''), str(html)])


def attendre(jeton, secondes, mot=''):
    fin = time.time() + secondes
    while time.time() < fin:
        time.sleep(6)
        _status, raw = ouvrir('https://api.mail.tm/messages', headers={'Authorization': 'Bearer ' + jeton})
        for item in json.loads(raw.decode()).get('hydra:member') or []:
            detail = texte_message(jeton, item['id'])
            if not mot or mot in detail:
                return detail
    return ''


def activer(adresse, jeton):
    status, raw = ouvrir(
        'https://formsubmit.co/ajax/' + urllib.parse.quote(adresse),
        data=json.dumps({'name': 'Study Plan IB', 'message': 'activation'}).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', **SITE},
        method='POST'
    )
    print('demande', status, raw.decode('utf-8', 'replace')[:180])
    detail = attendre(jeton, 50, 'formsubmit.co/confirm/')
    liens = re.findall(r'https://formsubmit\.co/confirm/[A-Za-z0-9]+', detail)
    print('confirmations', len(liens))
    if not liens:
        return False
    status, raw = ouvrir(liens[0], headers={'User-Agent': SITE['User-Agent']})
    print('clic', status, liens[0])
    return status < 400


def envoyer(proprio, eleve):
    payload = {
        'name': 'Study Plan IB',
        'email': eleve,
        '_replyto': 'ibstudyplan@gmail.com',
        '_subject': 'Reponse a ta question - Study Plan IB',
        '_cc': eleve,
        '_captcha': 'false',
        '_template': 'box',
        'message': MARQUE + '\n\nTa question :\nQuestion de verification\n\nStudy Plan IB',
    }
    status, raw = ouvrir(
        'https://formsubmit.co/ajax/' + urllib.parse.quote(proprio),
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', **SITE},
        method='POST'
    )
    print('envoi', status, raw.decode('utf-8', 'replace')[:240])
    return status, raw.decode('utf-8', 'replace')


def main():
    eleve, jeton_e = creer_boite('eleve')
    print('eleve', eleve)
    proprio = 'proprio1791644730@maxxspace.com'
    status, corps = envoyer(proprio, eleve)
    if 'success":"true' not in corps and '"success": "true"' not in corps and '"success":true' not in corps:
        proprio, jeton_p = creer_boite('proprio')
        print('nouveau_proprio', proprio)
        if not activer(proprio, jeton_p):
            raise SystemExit('activation_impossible')
        status, corps = envoyer(proprio, eleve)
    if 'true' not in corps:
        raise SystemExit('envoi_refuse')
    print('proprio_utile', proprio)
    if MARQUE in attendre(jeton_e, 70, MARQUE):
        print('livre')
        return
    raise SystemExit('pas_livre')


if __name__ == '__main__':
    main()
