#!/usr/bin/env python3
"""Envoie une lettre d'essai vers un Gmail réel avec le script déjà déployé."""

import json
import urllib.request

SCRIPT = 'https://script.google.com/macros/s/AKfycbz_rykUE5HgUg5fCh_p9FBwptfbSAMGfc3fw7jMR-u3JhcYYldkHG1iPqleF9XiHlgMfQ/exec'
SECRET = 'spib-7c4e9a2b8d1f6c3e'
SUJET = 'Réponse à ta question — Study Plan IB'
DESTINATAIRE = 'sawadogojuliss@gmail.com'


def main():
    texte = "Bonjour,\n\nEssai de livraison. Si tu lis ceci, Gmail a accepté la lettre.\n\nÀ bientôt,\nL'équipe Study Plan IB"
    html = "<p>Bonjour,</p><p>Essai de livraison. Si tu lis ceci, Gmail a accepté la lettre.</p><p>À bientôt,<br><strong>L'équipe Study Plan IB</strong></p>"
    payload = json.dumps({
        'secret': SECRET,
        'to': DESTINATAIRE,
        'replyTo': 'ibstudyplan@gmail.com',
        'subject': SUJET,
        'text': texte,
        'html': html,
    }).encode()
    req = urllib.request.Request(SCRIPT, data=payload, headers={'Content-Type': 'text/plain;charset=utf-8'}, method='POST')
    with urllib.request.urlopen(req, timeout=45) as res:
        print(res.status, res.read().decode('utf-8', 'replace')[:300])


if __name__ == '__main__':
    main()
