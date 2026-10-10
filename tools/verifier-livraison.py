#!/usr/bin/env python3
"""Active un formulaire, envoie une réponse, et vérifie qu'elle arrive."""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

MARQUE = 'REPONSE-STUDYPLAN-' + str(int(time.time()))
AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
SITE = {
    'User-Agent': AGENT,
    'Origin': 'https://sawadogojuliss-byte.github.io',
    'Referer': 'https://sawadogojuliss-byte.github.io/',
}


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, dict(res.headers), res.read()
    except urllib.error.HTTPError as exc:
        corps = b''
        try:
            corps = exc.read()
        except Exception:
            corps = b''
        return exc.code, dict(exc.headers or {}), corps


def creer_boite(prefix):
    status, _headers, raw = ouvrir('https://api.mail.tm/domains')
    domaines = json.loads(raw.decode()).get('hydra:member') or []
    if not domaines:
        raise SystemExit('aucun domaine')
    adresse = prefix + str(int(time.time())) + '@' + domaines[0]['domain']
    secret = 'Verification-' + prefix + str(int(time.time()))
    ouvrir('https://api.mail.tm/accounts', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    status, _headers, raw = ouvrir('https://api.mail.tm/token', data=json.dumps({
        'address': adresse, 'password': secret
    }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    jeton = json.loads(raw.decode()).get('token') or ''
    if not jeton:
        raise SystemExit('jeton absent ' + adresse)
    return adresse, jeton


def lire_messages(jeton):
    status, _headers, raw = ouvrir('https://api.mail.tm/messages', headers={'Authorization': 'Bearer ' + jeton})
    data = json.loads(raw.decode() or '{}')
    return data.get('hydra:member') or []


def lire_un(jeton, ident):
    status, _headers, raw = ouvrir('https://api.mail.tm/messages/' + ident, headers={'Authorization': 'Bearer ' + jeton})
    return raw.decode('utf-8', 'replace')


def attendre(jeton, secondes, mot=''):
    fin = time.time() + secondes
    while time.time() < fin:
        time.sleep(6)
        for item in lire_messages(jeton):
            ident = item.get('id')
            if not ident:
                continue
            detail = lire_un(jeton, ident)
            if not mot or mot in detail or mot in str(item.get('intro') or '') or mot in str(item.get('subject') or ''):
                return item, detail
    return None, ''


def lien_activation(texte):
    liens = re.findall(r'https://formsubmit\.co/[^\s\"\'<>]+', texte or '')
    for lien in liens:
        if 'activate' in lien or 'confirm' in lien:
            return lien.rstrip(').,')
    return liens[0].rstrip(').,') if liens else ''


def main():
    proprio, jeton_p = creer_boite('proprio')
    print('proprio', proprio)
    status, _headers, raw = ouvrir(
        'https://formsubmit.co/ajax/' + urllib.parse.quote(proprio),
        data=json.dumps({'name': 'Study Plan IB', 'message': 'activation ' + MARQUE}).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', **SITE},
        method='POST'
    )
    print('activation_http', status, raw.decode('utf-8', 'replace')[:400])
    _item, detail = attendre(jeton_p, 70)
    print('activation_mail', 'oui' if detail else 'non')
    lien = lien_activation(detail)
    print('lien', 'present' if lien else 'absent')
    if lien:
        status, headers, raw = ouvrir(lien, headers={'User-Agent': AGENT})
        print('clic', status, raw.decode('utf-8', 'replace')[:300].replace('\n', ' '))
    eleve, jeton_e = creer_boite('eleve')
    print('eleve', eleve)
    formulaire = urllib.parse.urlencode({
        'name': 'Study Plan IB',
        'email': eleve,
        '_replyto': 'ibstudyplan@gmail.com',
        '_subject': 'Reponse a ta question - Study Plan IB',
        '_cc': eleve,
        '_autoresponse': MARQUE,
        '_captcha': 'false',
        '_template': 'box',
        'message': MARQUE + '\nReponse de verification.',
    }).encode()
    status, _headers, raw = ouvrir(
        'https://formsubmit.co/' + urllib.parse.quote(proprio),
        data=formulaire,
        headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html', **SITE},
        method='POST'
    )
    print('envoi_form', status, raw.decode('utf-8', 'replace')[:350].replace('\n', ' '))
    status, _headers, raw = ouvrir(
        'https://formsubmit.co/ajax/' + urllib.parse.quote(proprio),
        data=json.dumps({
            'name': 'Study Plan IB',
            'email': eleve,
            '_replyto': 'ibstudyplan@gmail.com',
            '_subject': 'Reponse a ta question - Study Plan IB',
            '_cc': eleve,
            '_autoresponse': MARQUE,
            '_captcha': 'false',
            'message': MARQUE + '\nReponse ajax.',
        }).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', **SITE},
        method='POST'
    )
    print('envoi_ajax', status, raw.decode('utf-8', 'replace')[:350])
    _item, recu = attendre(jeton_e, 80, MARQUE)
    if MARQUE in recu:
        print('livre')
        return
    print('pas_livre')
    print('apercu', recu[:240].replace('\n', ' '))
    raise SystemExit(1)


if __name__ == '__main__':
    main()
