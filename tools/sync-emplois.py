#!/usr/bin/env python3
"""Rassemble les emplois du temps dans data/emplois.json.

Les navigateurs envoient chaque inscription vers ntfy et, si possible, vers
un coffre kvdb. Ce script est le backend durable : il relit ces sources et
garde la dernière fiche de chaque appareil, avec le compte Google s'il a
été ajouté plus tard.
"""

import json
import pathlib
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

DEST_URL = pathlib.Path('data/boite-url.json')
DEST_EMPLOIS = pathlib.Path('data/emplois.json')
DEST_RETOURS = pathlib.Path('data/retours.json')
DEST_RAPPELS = pathlib.Path('data/rappels.json')
SUJET = 'ibx-7c4e9a2b8d1f6c3e5a0b9d4f2e8c1a6b'
EMAIL = '234701558+sawadogojuliss-byte@users.noreply.github.com'


def ouvrir(url, data=None, headers=None, method=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read()


def lire_json(path, defaut):
    if not path.exists():
        return defaut
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return defaut


def ecrire(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def parser(texte):
    try:
        data = json.loads(texte)
    except Exception:
        return None
    return data if isinstance(data, dict) and data.get('type') else None


def lire_ntfy(sujet):
    url = 'https://ntfy.sh/' + urllib.parse.quote(sujet) + '/json?poll=1&since=all'
    try:
        _status, raw = ouvrir(url, headers={'Accept': 'application/x-ndjson'})
    except Exception as exc:
        print('ntfy indisponible', type(exc).__name__)
        return []
    out = []
    for ligne in raw.decode('utf-8', 'replace').splitlines():
        if not ligne.strip():
            continue
        try:
            enveloppe = json.loads(ligne)
        except Exception:
            continue
        if enveloppe.get('event') and enveloppe.get('event') != 'message':
            continue
        data = parser(enveloppe.get('message') or '')
        if data:
            out.append(data)
    print('ntfy', len(out))
    return out


def creer_kvdb():
    body = urllib.parse.urlencode({'email': EMAIL, 'default_ttl': '31536000'}).encode()
    try:
        _status, raw = ouvrir('https://kvdb.io', data=body, method='POST')
    except Exception as exc:
        print('kvdb creation impossible', type(exc).__name__)
        return ''
    bucket = raw.decode('utf-8', 'replace').strip()
    if bucket.startswith('{'):
        try:
            data = json.loads(bucket)
            bucket = str(data.get('id') or data.get('bucket') or '')
        except Exception:
            bucket = ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}', bucket):
        print('kvdb reponse inattendue')
        return ''
    url = 'https://kvdb.io/' + bucket
    try:
        ouvrir(url + '/probe_sync?ttl=60', data=b'ok', method='POST')
        _status, got = ouvrir(url + '/probe_sync')
        if got.decode('utf-8', 'replace').strip() != 'ok':
            print('kvdb illisible')
            return ''
    except Exception as exc:
        print('kvdb ecriture impossible', type(exc).__name__)
        return ''
    print('kvdb pret')
    return url


def lire_kvdb(url):
    if not url:
        return []
    try:
        _status, raw = ouvrir(url.rstrip('/') + '/?values=true&format=json&limit=2000')
        lignes = json.loads(raw.decode('utf-8', 'replace'))
    except Exception as exc:
        print('kvdb lecture impossible', type(exc).__name__)
        return []
    out = []
    for ligne in lignes if isinstance(lignes, list) else []:
        valeur = ligne[1] if isinstance(ligne, list) and len(ligne) > 1 else ligne
        if isinstance(valeur, str):
            valeur = parser(valeur)
        if isinstance(valeur, dict) and valeur.get('type'):
            out.append(valeur)
    print('kvdb', len(out))
    return out


def creer_archive():
    payload = json.dumps({'questions': [], 'feedbacks': [], 'emplois': [], 'reponses': []}).encode()
    try:
        _status, raw = ouvrir(
            'https://api.jsonstorage.net/v1/json',
            data=payload,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )
    except Exception as exc:
        print('archive indisponible', type(exc).__name__)
        return ''
    uri = ''
    try:
        data = json.loads(raw.decode('utf-8', 'replace'))
        if isinstance(data, dict):
            uri = data.get('uri') or data.get('url') or ''
    except Exception:
        uri = ''
    if uri.startswith('/'):
        uri = 'https://api.jsonstorage.net' + uri
    if not uri.startswith('https://'):
        print('archive sans adresse')
        return ''
    print('archive prete')
    return uri


def lire_archive(url):
    if not url:
        return []
    try:
        _status, raw = ouvrir(url)
        doc = json.loads(raw.decode('utf-8', 'replace'))
    except Exception as exc:
        print('archive illisible', type(exc).__name__)
        return []
    if not isinstance(doc, dict):
        return []
    return [item for item in (doc.get('emplois') or []) if isinstance(item, dict)]


JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']


def joindre_jours(anciens, nouveaux):
    carte = {}
    for jour in anciens or []:
        if isinstance(jour, dict) and jour.get('j'):
            carte[jour['j']] = jour
    for jour in nouveaux or []:
        if isinstance(jour, dict) and jour.get('j'):
            carte[jour['j']] = jour
    return [carte[nom] for nom in JOURS if nom in carte]


def completer(ancien, nouveau):
    if not ancien:
        return nouveau
    for champ in ('google', 'googleSub', 'googleNom', 'email', 'classe', 'nom'):
        if not nouveau.get(champ) and ancien.get(champ):
            nouveau[champ] = ancien[champ]
    if not nouveau.get('matieres') and ancien.get('matieres'):
        nouveau['matieres'] = ancien['matieres']
    nouveau['jours'] = joindre_jours(ancien.get('jours'), nouveau.get('jours'))
    return nouveau


def normaliser(texte):
    valeur = unicodedata.normalize('NFD', str(texte or '').lower())
    valeur = ''.join(ch for ch in valeur if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', valeur).strip()


def nom_utile(item):
    nom = str(item.get('nom') or '').strip()
    cle = normaliser(nom)
    if not cle or cle in ('u', 'julia', 'sans nom'):
        return ''
    return nom


def mail_personne(item):
    return str(item.get('google') or item.get('email') or '').strip().lower()


def meme_personne(a, b):
    sub_a = str(a.get('googleSub') or '').strip()
    sub_b = str(b.get('googleSub') or '').strip()
    if sub_a and sub_a == sub_b:
        return True
    mail_a = mail_personne(a)
    mail_b = mail_personne(b)
    if mail_a and mail_b and mail_a == mail_b:
        return True
    nom_a = normaliser(nom_utile(a))
    nom_b = normaliser(nom_utile(b))
    if nom_a and nom_b and nom_a == nom_b:
        return True
    app_a = str(a.get('appareil') or '').strip()
    app_b = str(b.get('appareil') or '').strip()
    if app_a and app_a == app_b and (not nom_a or not nom_b or nom_a == nom_b):
        return True
    return False


def richesse(item):
    total = 0
    for jour in item.get('jours') or []:
        if isinstance(jour, dict):
            total += len(jour.get('s') or [])
    return total


def joindre_personne(a, b):
    if not a:
        return b
    if not b:
        return a
    if richesse(b) > richesse(a) or (richesse(b) == richesse(a) and str(b.get('at') or '') >= str(a.get('at') or '')):
        garde, autre = dict(b), a
    else:
        garde, autre = dict(a), b
    nom = nom_utile(garde) or nom_utile(autre) or str(garde.get('googleNom') or autre.get('googleNom') or '').strip()
    garde['nom'] = nom
    garde['classe'] = garde.get('classe') or autre.get('classe') or ''
    garde['email'] = garde.get('email') or autre.get('email') or garde.get('google') or autre.get('google') or ''
    garde['google'] = garde.get('google') or autre.get('google') or garde.get('email') or autre.get('email') or ''
    garde['googleNom'] = garde.get('googleNom') or autre.get('googleNom') or ''
    garde['googleSub'] = garde.get('googleSub') or autre.get('googleSub') or ''
    garde['appareil'] = garde.get('appareil') or autre.get('appareil') or ''
    if not garde.get('matieres') and autre.get('matieres'):
        garde['matieres'] = autre.get('matieres')
    garde['jours'] = joindre_jours(autre.get('jours'), garde.get('jours'))
    if str(autre.get('at') or '') > str(garde.get('at') or ''):
        garde['at'] = autre.get('at')
    garde['type'] = 'emploi'
    return garde


def depuis_message(item):
    if item.get('type') not in ('question', 'feedback'):
        return None
    if normaliser(item.get('nom')) in ('u', 'julia'):
        return None
    if not (nom_utile(item) or mail_personne(item) or item.get('googleSub')):
        return None
    return {
        'type': 'emploi',
        'id': 'msg_' + str(item.get('id') or ''),
        'appareil': item.get('appareil') or '',
        'at': item.get('at') or '',
        'nom': item.get('nom') or '',
        'classe': item.get('classe') or '',
        'email': item.get('email') or '',
        'google': item.get('google') or item.get('email') or '',
        'googleNom': item.get('googleNom') or '',
        'googleSub': item.get('googleSub') or '',
        'matieres': item.get('matieres') or [],
        'jours': item.get('jours') or [],
    }


def fusionner(items):
    bruts = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get('type') == 'emploi':
            if normaliser(item.get('nom')) in ('u', 'julia'):
                continue
            bruts.append(dict(item))
        else:
            personne = depuis_message(item)
            if personne:
                bruts.append(personne)
    groupes = []
    for item in bruts:
        trouve = next((i for i, deja in enumerate(groupes) if meme_personne(deja, item)), -1)
        if trouve == -1:
            groupes.append(item)
        else:
            groupes[trouve] = joindre_personne(groupes[trouve], item)
    stable = False
    while not stable:
        stable = True
        i = 0
        while i < len(groupes):
            j = i + 1
            while j < len(groupes):
                if meme_personne(groupes[i], groupes[j]):
                    groupes[i] = joindre_personne(groupes[i], groupes[j])
                    del groupes[j]
                    stable = False
                    break
                j += 1
            if not stable:
                break
            i += 1
    groupes.sort(key=lambda item: normaliser(item.get('nom') or item.get('googleNom')))
    return groupes[:300]


def leger(item):
    return {
        'type': 'emploi',
        'id': item.get('id') or '',
        'appareil': item.get('appareil') or '',
        'at': item.get('at') or '',
        'nom': item.get('nom') or '',
        'classe': item.get('classe') or '',
        'email': item.get('email') or '',
        'google': item.get('google') or '',
        'googleNom': item.get('googleNom') or '',
        'googleSub': item.get('googleSub') or '',
        'matieres': item.get('matieres') or [],
        'jours': item.get('jours') or [],
    }


def ecrire_archive(url, emplois):
    if not url:
        return
    try:
        _status, raw = ouvrir(url, headers={'Accept': 'application/json'})
        doc = json.loads(raw.decode('utf-8', 'replace'))
    except Exception as exc:
        print('archive ecriture ignoree', type(exc).__name__)
        return
    if not isinstance(doc, dict):
        doc = {}
    doc['emplois'] = emplois
    doc.setdefault('questions', [])
    doc.setdefault('feedbacks', [])
    doc.setdefault('reponses', [])
    try:
        ouvrir(
            url,
            data=json.dumps(doc, ensure_ascii=False).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='PUT',
        )
        print('archive mise a jour', len(emplois))
    except Exception as exc:
        print('archive ecriture impossible', type(exc).__name__)


def cle_matiere(nom):
    texte = unicodedata.normalize('NFD', str(nom or '').lower())
    texte = ''.join(ch for ch in texte if unicodedata.category(ch) != 'Mn')
    texte = re.sub(r'\b(hl|sl)\b', ' ', texte)
    return re.sub(r'[^a-z0-9]+', ' ', texte).strip()


def est_anglais_b(nom):
    cle = cle_matiere(nom)
    return cle == 'anglais b' or cle == 'english b'


def niveau_de(nom, niveau=''):
    trouve = re.search(r'\b(HL|SL)\b', str(niveau or ''), re.I) or re.search(r'\b(HL|SL)\b', str(nom or ''), re.I)
    return trouve.group(1).upper() if trouve else ''


def cle_groupe(nom, niveau=''):
    cle = cle_matiere(nom)
    if not cle:
        return ''
    if est_anglais_b(nom):
        niv = niveau_de(nom, niveau)
        return (cle + ' ' + niv.lower()) if niv else ''
    return cle


def nom_groupe(nom, niveau=''):
    base = nom_matiere(nom)
    if est_anglais_b(nom):
        niv = niveau_de(nom, niveau)
        return (base + ' ' + niv).strip() if niv else ''
    return base


def nom_matiere(nom):
    return re.sub(r'\s+(HL|SL)\s*$', '', str(nom or '').strip(), flags=re.I).strip()


def groupes_et_exercices(items, emplois):
    groupes = {}
    exercices = {}

    def ajouter(appareil, nom, classe, matiere, niveau=''):
        if not appareil:
            return
        cle = cle_groupe(matiere, niveau)
        affiche = nom_groupe(matiere, niveau)
        if not cle or not affiche:
            return
        lot = groupes.setdefault(cle, {'cle': cle, 'matiere': affiche, 'eleves': {}})
        deja = lot['eleves'].get(appareil) or {}
        lot['eleves'][appareil] = {
            'appareil': appareil,
            'nom': nom or deja.get('nom') or '',
            'classe': classe or deja.get('classe') or '',
        }

    for emp in emplois or []:
        if not isinstance(emp, dict):
            continue
        for raw in emp.get('matieres') or []:
            ajouter(str(emp.get('appareil') or ''), emp.get('nom') or '', emp.get('classe') or '', raw)
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if item.get('type') == 'groupe':
            for raw in item.get('matieres') or []:
                ajouter(str(item.get('appareil') or ''), item.get('nom') or '', item.get('classe') or '', raw)
            continue
        if item.get('type') != 'rappel' or not cle_groupe(item.get('matiere'), item.get('niveau')):
            continue
        ident = str(item.get('id') or '')
        if not ident:
            continue
        niveau = item.get('niveau') or niveau_de(item.get('matiere'))
        deja = exercices.get(ident)
        if not deja or str(item.get('at') or '') >= str(deja.get('at') or ''):
            exercices[ident] = {
                'type': 'rappel',
                'id': ident,
                'appareil': item.get('appareil') or '',
                'at': item.get('at') or '',
                'nom': item.get('nom') or '',
                'matiere': nom_matiere(item.get('matiere') or ''),
                'niveau': niveau,
                'jour': item.get('jour'),
                'debut': item.get('debut') or '',
                'fin': item.get('fin') or '',
                'exo': item.get('exo') or '',
            }
        ajouter(str(item.get('appareil') or ''), item.get('nom') or '', item.get('classe') or '', item.get('matiere') or '', niveau)
    lots = []
    for cle in sorted(groupes):
        eleves = list(groupes[cle]['eleves'].values())
        eleves.sort(key=lambda eleve: str(eleve.get('nom') or '').lower())
        lots.append({'cle': cle, 'matiere': groupes[cle]['matiere'], 'eleves': eleves})
    exos = list(exercices.values())
    exos.sort(key=lambda exo: str(exo.get('at') or ''))
    return lots, exos[-500:]


def main():
    config = lire_json(DEST_URL, {'sujet': SUJET, 'kvdb': '', 'archive': ''})
    config.setdefault('sujet', SUJET)
    if not config.get('kvdb'):
        config['kvdb'] = creer_kvdb()
    if not config.get('archive'):
        config['archive'] = creer_archive()
    ecrire(DEST_URL, {
        'sujet': config.get('sujet') or SUJET,
        'kvdb': config.get('kvdb') or '',
        'archive': config.get('archive') or '',
    })
    existants = lire_json(DEST_EMPLOIS, {}).get('emplois') or []
    messages = lire_ntfy(config.get('sujet') or SUJET)
    if not config.get('archive'):
        for item in messages:
            url = str(item.get('archive') or '') if isinstance(item, dict) else ''
            if item.get('type') == 'coffre' and url.startswith('https://'):
                config['archive'] = url
                break
    items = list(existants) + messages
    items.extend(lire_kvdb(config.get('kvdb') or ''))
    items.extend(lire_archive(config.get('archive') or ''))
    emplois = [leger(item) for item in fusionner(items)]
    ecrire(DEST_EMPLOIS, {'emplois': emplois})
    ecrire(DEST_RETOURS, {
        'questions': [item for item in items if isinstance(item, dict) and item.get('type') == 'question'][-120:],
        'feedbacks': [item for item in items if isinstance(item, dict) and item.get('type') == 'feedback'][-120:],
        'reponses': [item for item in items if isinstance(item, dict) and item.get('type') == 'reponse'][-120:],
    })
    ecrire_archive(config.get('archive') or '', emplois)
    anciens = lire_json(DEST_RAPPELS, {}).get('exercices') or []
    lots, exos = groupes_et_exercices(list(anciens) + items, emplois)
    ecrire(DEST_RAPPELS, {'groupes': lots, 'exercices': exos})
    print('emplois', len(emplois), 'groupes', len(lots), 'rappels', len(exos))


if __name__ == '__main__':
    main()
