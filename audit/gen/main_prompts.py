# -*- coding: utf-8 -*-
"""Génère le guide de prompts (PDF) qui accompagne l'audit."""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import construire as C
import p_base as B
import p_lots as L
from construire import P, S, esc, rich
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Flowable, Frame, KeepTogether, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

SORTIE = os.path.join(os.path.dirname(ICI), 'Study-Plan-IB-guide-prompts.pdf')

S['marque'] = ParagraphStyle('toc0', fontName='DJ', fontSize=1, leading=1,
                             textColor=colors.white)
S['couv_t'] = ParagraphStyle('ct', fontName='DJB', fontSize=30, leading=36,
                             textColor=colors.white, alignment=TA_LEFT)
S['couv_s'] = ParagraphStyle('cs', fontName='DJ', fontSize=13.5, leading=19,
                             textColor=colors.HexColor('#a7f3d0'), alignment=TA_LEFT)
S['couv_p'] = ParagraphStyle('cp', fontName='DJB', fontSize=7, leading=8,
                             textColor=colors.HexColor('#6ee7b7'), alignment=TA_LEFT)
S['couv_c'] = ParagraphStyle('cc', fontName='DJ', fontSize=10, leading=16,
                             textColor=colors.white, alignment=TA_LEFT)
S['couv_meta'] = ParagraphStyle('cm', fontName='DJ', fontSize=8, leading=12.5,
                                textColor=colors.HexColor('#d1fae5'), alignment=TA_LEFT)
S['prompt'] = ParagraphStyle('prompt', fontName='DJ', fontSize=8.0, leading=11.5,
                             textColor=colors.HexColor('#1f2937'), alignment=TA_LEFT)
S['prompt_lbl'] = ParagraphStyle('plbl', fontName='DJB', fontSize=6.4, leading=8,
                                 textColor=colors.HexColor('#0f766e'))
S['lot_titre'] = ParagraphStyle('lt', fontName='DJB', fontSize=12.5, leading=15.5,
                                textColor=colors.white, alignment=TA_LEFT)
S['lot_meta'] = ParagraphStyle('lm', fontName='DJ', fontSize=8, leading=11,
                               textColor=colors.HexColor('#166534'))

VERT_LOT = colors.HexColor('#065f46')
FOND_PROMPT = colors.HexColor('#f8fafc')
BORD_PROMPT = colors.HexColor('#cbd5e1')


def couv():
    st = [Spacer(1, 26 * mm)]
    st.append(Paragraph('STUDY PLAN IB · COMPAGNON DE L’AUDIT', S['couv_p']))
    st.append(Spacer(1, 8 * mm))
    st.append(Paragraph('Guide de prompts', S['couv_t']))
    st.append(Spacer(1, 5 * mm))
    st.append(Paragraph('Réparer le site,<br/>lot par lot', S['couv_s']))
    st.append(Spacer(1, 14 * mm))
    st.append(Paragraph(
        "Dix-neuf textes à coller dans une session d’assistant de code, dans l’ordre. "
        "Chacun traite un groupe de constats qui partagent une cause, dit ce qu’on attend, "
        "ce qu’on ne veut pas, et comment vérifier. Rien n’est laissé à l’improvisation — "
        "surtout pas la définition de « terminé ».", S['couv_c']))
    st.append(Spacer(1, 18 * mm))

    lignes = [
        ('Objet', 'Les 121 constats de l’audit, regroupés en 19 lots'),
        ('Ordre', 'Sécurité → mensonges → pertes de travail → confort'),
        ('Charge estimée', 'Une dizaine de jours, hors concertation'),
        ('Comporte', '1 prompt maître, 1 gabarit, 10 règles, 19 lots, 5 contrôles'),
        ('Usage', 'Un lot par session. Un commit par lot. Aucun lot sans preuve.'),
    ]
    t = Table([[Paragraph(k.upper(), ParagraphStyle('k', fontName='DJB', fontSize=6.3,
                                                    textColor=colors.HexColor('#6ee7b7'))),
                Paragraph(esc(v), S['couv_meta'])] for k, v in lignes],
              colWidths=[33 * mm, 127 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -2), 0.3, colors.HexColor('#047857')),
    ]))
    st.append(t)
    return st


class MonDoc(C.Doc):
    pass


doc = MonDoc(SORTIE, leftMargin=20 * mm, rightMargin=20 * mm,
             topMargin=17 * mm, bottomMargin=18 * mm,
             title='Study Plan IB — Guide de prompts',
             author='Audit technique',
             subject='Les prompts pour corriger les 121 constats, lot par lot')

frame_cov = Frame(20 * mm, 22 * mm, 170 * mm, A4[1] - 44 * mm, id='cov',
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
frame_norm = Frame(20 * mm, 20 * mm, 170 * mm, A4[1] - 40 * mm, id='norm',
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([
    PageTemplate(id='couverture', frames=[frame_cov], onPage=C.couverture),
    PageTemplate(id='normal', frames=[frame_norm], onPage=C.fond_et_pied),
])


def ancre(titre):
    return [Paragraph(titre, S['marque'])]


def sans_repetitions(txt):
    """Retire du prompt ce qui est repris juste après en encadré (checklist et piège),
    pour ne pas faire lire deux fois la même chose à l'utilisateur."""
    utiles = []
    for ligne in txt.strip('\n').split('\n'):
        debut = ligne.strip()
        if debut.startswith('Vous devez obtenir'):
            break
        if debut.startswith(('Piège :', 'Attention :')):
            break
        utiles.append(ligne)
    return '\n'.join(utiles).rstrip()


def bloc_prompt(txt, libelle='PROMPT À COLLER'):
    lignes = [esc(l.rstrip()) for l in sans_repetitions(txt).split('\n')]
    p = Paragraph('<br/>'.join(lignes), S['prompt'])
    entete = Paragraph(libelle, S['prompt_lbl'])
    t = Table([[entete], [p]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), FOND_PROMPT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORD_PROMPT),
        ('LINEBEFORE', (0, 0), (0, -1), 3, colors.HexColor('#0d9488')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (0, 0), 6),
        ('BOTTOMPADDING', (0, 0), (0, 0), 1),
        ('TOPPADDING', (0, 1), (0, 1), 2),
        ('BOTTOMPADDING', (0, 1), (0, 1), 9),
    ]))
    return t


def entete_lot(lot):
    gauche = Paragraph(esc('Lot %d — %s' % (lot['num'], lot['titre'])), S['lot_titre'])
    droite = Paragraph(esc('%s · %s' % (lot['vague'], lot['effort'])),
                       ParagraphStyle('d', fontName='DJB', fontSize=8, leading=10,
                                      textColor=colors.HexColor('#d1fae5'), alignment=2))
    t = Table([[gauche, droite]], colWidths=[132 * mm, 38 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), VERT_LOT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def ligne_meta(lot):
    ids = ', '.join(lot['ids'])
    lignes = [
        [Paragraph('CONSTATS', S['prompt_lbl']), Paragraph(esc(ids), S['lot_meta'])],
        [Paragraph('FICHIERS', S['prompt_lbl']), Paragraph(esc(lot['fichiers']), S['lot_meta'])],
        [Paragraph('QUAND', S['prompt_lbl']), Paragraph(esc(lot['quand']), S['lot_meta'])],
    ]
    t = Table(lignes, colWidths=[22 * mm, 148 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
    ]))
    return t


story = couv()
story.append(NextPageTemplate('normal'))
story.append(PageBreak())

# ── Sommaire ────────────────────────────────────────────────────────
story += C.bandeau('Sommaire')
toc = TableOfContents()
toc.levelStyles = [S['toc1']]
toc.dotsMinLevel = 0
story.append(toc)


# ── Mode d'emploi ───────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Mode d’emploi')
story += C.bandeau('Mode d’emploi')
story.append(P(B.INTRO))
story += C.encart("Ce que ce document n’est pas",
                  "Ce n’est pas une liste de 121 ordres. Les constats qui partagent une cause sont "
                  "regroupés : c’est la seule façon d’obtenir un résultat qu’on peut tester. Et ce n’est "
                  "pas un mode d’emploi de l’assistant : c’est un contrat — ce qu’on demande, ce qu’on "
                  "interdit, et la preuve qu’on exige en retour.", couleur=C.BLEU,
                  fond=colors.HexColor('#eff6ff'))
story.append(Spacer(1, 2 * mm))
for i, (titre, txt) in enumerate(B.MODE_EMPLOI, 1):
    story.append(KeepTogether([
        Paragraph(esc('%d. %s' % (i, titre)), S['h3']),
        P(txt),
    ]))

story.append(Spacer(1, 4 * mm))
story += C.encart("Combien de temps, honnêtement",
                  "Un lot par session, et une session ne se termine pas toujours dans la journée. Les "
                  "lots 0 à 6 tiennent en une semaine à temps plein ; le lot 9 (synchronisation) mérite "
                  "une journée seule, avec une sauvegarde avant de commencer ; le lot 18 n’est pas "
                  "obligatoire. Si vous ne faites que les lots 0, 1, 2, 3 et 5, vous aurez déjà réglé "
                  "les cinq constats les plus visibles du site.")

# ── Prompt maître ───────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Le prompt maître')
story += C.bandeau('Le prompt maître')
story.append(P("À coller **au début de chaque session**, avant le prompt du lot. Il rappelle les règles "
               "du projet et fixe ce que « terminé » veut dire. Sans lui, l’assistant improvise — et il "
               "improvise rarement dans le sens de vos contraintes."))
story.append(Spacer(1, 2 * mm))
story.append(bloc_prompt(B.MAITRE, 'PROMPT MAÎTRE — À COLLER EN PREMIER'))
story.append(Spacer(1, 3 * mm))
story.append(P("Les règles 1 à 3 sont celles qui font la différence. Un assistant qui n’a pas "
               "l’interdiction explicite du « pendant que j’y suis » ajoutera des changements que vous ne "
               "pourrez pas relire. Et un assistant à qui on ne demande pas de preuve vous répondra que "
               "tout fonctionne."))

# ── Gabarit ─────────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Le gabarit')
story += C.bandeau('Le gabarit')
story.append(P("Les prompts des pages suivantes suivent tous cette structure. Vous pouvez l’utiliser "
               "pour écrire les vôtres — pour un bug que vous découvrez, ou pour un constat qui mérite "
               "d’être traité différemment."))
story.append(Spacer(1, 2 * mm))
story.append(bloc_prompt(B.GABARIT, 'GABARIT — À ADAPTER'))
story.append(Spacer(1, 3 * mm))
story.append(Paragraph('Pourquoi ces six lignes', S['h2']))
for titre, txt in [
    ("Le but en une phrase", "C’est ce qui empêche l’assistant de choisir une autre interprétation que "
     "la vôtre. « L’import des examens doit afficher ses résultats » ne laisse pas de place à une "
     "refonte de la page."),
    ("Les fichiers", "Un assistant qui doit chercher lui-même ouvre vingt fichiers et en modifie trois "
     "de trop. Nommez-les."),
    ("Ce que je veux exactement", "Numéroté, formulé comme un test. Chaque point doit pouvoir se "
     "vérifier par une manipulation."),
    ("Ce que je ne veux pas", "La ligne la plus utile, et celle que tout le monde oublie. C’est elle "
     "qui évite le refactor opportuniste."),
    ("Comment on vérifie", "Si vous ne pouvez pas l’écrire, le correctif n’est pas défini. C’est un "
     "critère, pas une formalité."),
    ("Le format de réponse", "Le plan d’abord, la preuve ensuite. Cela vous laisse arrêter avant que "
     "trois cents lignes soient écrites dans la mauvaise direction."),
]:
    story.append(KeepTogether([Paragraph(esc(titre), S['h3']), P(txt)]))

# ── Règles ──────────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Les dix règles')
story += C.bandeau('Les dix règles')
story.append(P("Elles ne dépendent d’aucun lot. Elles valent pour toutes les demandes, y compris celles "
               "que vous écrirez vous-même."))
story.append(Spacer(1, 3 * mm))
for i, (titre, txt) in enumerate(B.REGLES, 1):
    story.append(KeepTogether([
        Paragraph(esc('%d. %s' % (i, titre)), S['h3']),
        P(txt),
    ]))

# ── Les lots ────────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Les dix-neuf lots')
story += C.bandeau('Les dix-neuf lots')
# contrôle de couverture : les 121 constats doivent être dans un lot, une seule fois
_couverts = {}
for _lot in L.LOTS:
    for _id in _lot['ids']:
        _couverts.setdefault(_id, []).append(_lot['num'])
_manquants = sorted({i['id'] for i in C.D.TOUS} - set(_couverts))
assert not _manquants, 'constats sans lot : %s' % _manquants
_doubles = {k: v for k, v in _couverts.items() if len(v) > 1}
assert not _doubles, 'constats dans deux lots : %s' % _doubles

story.append(P("Dans l’ordre. Les numéros ne sont pas décoratifs : chaque lot suppose les précédents "
               "faits, sauf mention contraire. La colonne « quand » le dit. Les %d constats de l’audit "
               "sont répartis dans les dix-neuf lots, chacun dans un seul — c’est vérifié à la "
               "construction de ce document." % len(C.D.TOUS)))
story.append(Spacer(1, 3 * mm))

tableau = [[Paragraph('Lot', S['cellb']), Paragraph('Ce qu’il règle', S['cellb']),
            Paragraph('Constats', S['cellb']), Paragraph('Effort', S['cellb'])]]
for lot in L.LOTS:
    tableau.append([
        Paragraph(rich('**%d**' % lot['num']), S['cell']),
        Paragraph(esc(lot['titre']), S['cell']),
        Paragraph(esc('%d constats' % len(lot['ids'])), S['cell']),
        Paragraph(esc(lot['effort']), S['cell']),
    ])
t = Table(tableau, colWidths=[14 * mm, 104 * mm, 28 * mm, 24 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
]))
story.append(t)
story.append(Spacer(1, 4 * mm))
story.append(P("Total : 121 constats couverts, et quelques ajouts du lot 18 qui ne sont pas des "
               "corrections. Les lots 0 à 3 représentent à eux seuls la moitié du bénéfice perçu pour "
               "un quart du travail."))
story.append(Spacer(1, 5 * mm))
story.append(Paragraph('Le chemin court', S['h2']))
story.append(P("Si vous ne faites que cinq lots, faites ceux-là, dans cet ordre : **0** (la porte), "
               "**1** (les examens qui ne répondent pas), **2** (les révisions dans le passé), "
               "**3** (la page Séance), **5** (les exercices qui ne se terminent jamais). Onze heures au "
               "total, et le site change de visage."))
story.append(Spacer(1, 2 * mm))
story.append(P("Le reste peut attendre. Ce qui ne peut pas attendre, c’est le lot 0 : chaque semaine "
               "d’attente ajoute des messages exposés sur un canal public."))

HAUTEUR = A4[1] - 40 * mm


class SautSiBesoin(Flowable):
    """Va à la page suivante, sauf si on est déjà en haut — ce qui évite les pages blanches."""

    def wrap(self, aw, ah):
        self.height = ah if ah < HAUTEUR - 1 else 0
        return (aw, self.height)

    def draw(self):
        pass


def saut():
    return SautSiBesoin()


for lot in L.LOTS:
    story.append(saut())
    story += ancre('Lot %d — %s' % (lot['num'], lot['titre']))
    story.append(Spacer(1, 2 * mm))
    story.append(entete_lot(lot))
    story.append(Spacer(1, 2.5 * mm))
    story.append(ligne_meta(lot))
    story.append(Spacer(1, 3 * mm))
    story.append(bloc_prompt(lot['prompt'], 'PROMPT DU LOT %d — À COLLER APRÈS LE PROMPT MAÎTRE' % lot['num']))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph('Vous devez obtenir', S['h3']))
    for point in lot['attendu']:
        story.append(Paragraph(esc('— ' + point), S['corps']))
    story.append(Spacer(1, 1.5 * mm))
    # pas d'espace final : il tomberait seul sur la page suivante et créerait une page blanche
    story += C.encart('Le piège de ce lot', lot['piege'], couleur=C.AMBRE,
                      fond=C.AMBRE_FOND)[:-1]

# ── Contrôles ───────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Les cinq contrôles')
story += C.bandeau('Les cinq contrôles')
story.append(P("À utiliser entre les lots, ou juste après. Ce sont eux qui font la différence entre un "
               "correctif et une intention."))
story.append(Spacer(1, 3 * mm))

for c in B.CONTROLES:
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(esc(c['titre']), S['h2']))
    story.append(Paragraph(esc(c['quand']), S['petit']))
    story.append(Spacer(1, 1.5 * mm))
    story.append(bloc_prompt(c['prompt'], 'PROMPT DE CONTRÔLE'))
    story.append(Spacer(1, 2 * mm))

# ── Anti-exemples ───────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Ce qu’il ne faut pas écrire')
story += C.bandeau('Ce qu’il ne faut pas écrire')
story.append(P("Six demandes qui semblent raisonnables et qui produisent, sur ce dépôt précis, un site "
               "cassé ou un travail impossible à vérifier."))
story.append(Spacer(1, 3 * mm))

for mauvais, quoi, mieux in B.ANTI:
    bloc = Table([
        [Paragraph(esc('« %s »' % mauvais), ParagraphStyle('m', fontName='DJB', fontSize=9.5,
                                                           leading=12, textColor=C.ROUGE))],
        [Paragraph(esc(quoi), ParagraphStyle('q', fontSize=8.8, leading=12.4,
                                             textColor=C.ENCRE))],
        [Paragraph(rich('**À la place :** ' + mieux), ParagraphStyle('p2', fontSize=8.8, leading=12.4,
                                                                     textColor=C.VERT))],
    ], colWidths=[170 * mm])
    bloc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
        ('LINEBEFORE', (0, 0), (0, -1), 2.5, C.ROUGE),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (0, 0), 6),
        ('BOTTOMPADDING', (0, 0), (0, 0), 2),
        ('TOPPADDING', (0, 1), (0, 1), 2),
        ('BOTTOMPADDING', (0, 1), (0, 1), 5),
        ('TOPPADDING', (0, 2), (0, 2), 2),
        ('BOTTOMPADDING', (0, 2), (0, 2), 7),
        ('LINEABOVE', (0, 2), (0, 2), 0.4, colors.HexColor('#e5e7eb')),
    ]))
    story.append(KeepTogether([bloc, Spacer(1, 4 * mm)]))

# ── Suivi ───────────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Tableau de suivi')
story += C.bandeau('Tableau de suivi')
story.append(P("À imprimer ou à garder ouvert. Ce qui n’est pas coché n’est pas fait, même si "
               "l’assistant a dit qu’il l’avait fait. La dernière colonne sert à noter la date et le "
               "commit."))
story.append(Spacer(1, 3 * mm))

lignes = [[Paragraph('', S['cellb']), Paragraph('Lot', S['cellb']),
           Paragraph('Constats', S['cellb']), Paragraph('Effort', S['cellb']),
           Paragraph('Commit / date', S['cellb'])]]
for lot in L.LOTS:
    lignes.append([
        Paragraph('☐', ParagraphStyle('box', fontName='DJ', fontSize=11, leading=13,
                                      textColor=C.GRIS)),
        Paragraph(esc('%d. %s' % (lot['num'], lot['titre'])), ParagraphStyle('l', fontSize=8, leading=10.5)),
        Paragraph(esc(', '.join(lot['ids'])), ParagraphStyle('i2', fontName='DJM', fontSize=6.4,
                                                             leading=9, textColor=C.GRIS)),
        Paragraph(esc(lot['effort']), ParagraphStyle('e2', fontSize=7.5, leading=10)),
        Paragraph('', S['cell']),
    ])
t = Table(lignes, colWidths=[8 * mm, 52 * mm, 72 * mm, 16 * mm, 22 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3.2),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
]))
story.append(t)

story.append(Spacer(1, 7 * mm))
story += C.encart('Quand vous aurez fini',
                  "Reprenez le PDF d’audit et parcourez l’annexe : chaque identifiant coché ici devrait "
                  "correspondre à un constat fermé. Les constats qui resteront ouverts sont, en "
                  "pratique, ceux qui demandaient une décision de produit — le lot 18, et les questions "
                  "du chapitre « Questions avant d’agir » de l’audit.")

doc.multiBuild(story)
print('PDF écrit :', SORTIE)
print('pages :', doc.page)
