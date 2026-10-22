# -*- coding: utf-8 -*-
"""Génère le PDF d'audit Study Plan IB."""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import construire as C
from construire import P, S, esc, rich
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (CondPageBreak, Frame, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether)
from reportlab.platypus.tableofcontents import TableOfContents

D = C.D
SORTIE = os.path.join(os.path.dirname(ICI), 'Study-Plan-IB-audit-complet.pdf')

S['marque'] = ParagraphStyle('toc0', fontName='DJ', fontSize=1, leading=1,
                             spaceBefore=0, spaceAfter=0, textColor=colors.white)
S['couv_t'] = ParagraphStyle('ct', fontName='DJB', fontSize=31, leading=37,
                             textColor=colors.white, alignment=TA_LEFT)
S['couv_s'] = ParagraphStyle('cs', fontName='DJ', fontSize=13.5, leading=19,
                             textColor=colors.HexColor('#a7f3d0'), alignment=TA_LEFT)
S['couv_p'] = ParagraphStyle('cp', fontName='DJB', fontSize=7, leading=8,
                             textColor=colors.HexColor('#6ee7b7'), alignment=TA_LEFT)
S['couv_c'] = ParagraphStyle('cc', fontName='DJ', fontSize=10, leading=16,
                             textColor=colors.white, alignment=TA_LEFT)
S['couv_meta'] = ParagraphStyle('cm', fontName='DJ', fontSize=8, leading=12.5,
                                textColor=colors.HexColor('#d1fae5'), alignment=TA_LEFT)
S['couv_k'] = ParagraphStyle('ck', fontName='DJB', fontSize=6.3, leading=8,
                             textColor=colors.HexColor('#6ee7b7'), alignment=TA_LEFT)


def couv():
    st = [Spacer(1, 22 * mm)]
    st.append(Paragraph('STUDY PLAN IB', S['couv_p']))
    st.append(Spacer(1, 7 * mm))
    st.append(Paragraph('Audit complet', S['couv_t']))
    st.append(Spacer(1, 4 * mm))
    st.append(Paragraph(D.COUVERTURE['sous_titre'], S['couv_s']))
    st.append(Spacer(1, 13 * mm))
    st.append(Paragraph(rich(D.COUVERTURE['chapeau']), S['couv_c']))
    st.append(Spacer(1, 15 * mm))

    lignes = [[Paragraph(k.upper(), S['couv_k']), Paragraph(rich(v), S['couv_meta'])]
              for k, v in D.COUVERTURE['meta']]
    t = Table(lignes, colWidths=[33 * mm, 127 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LINEBELOW', (0, 0), (-1, -2), 0.3, colors.HexColor('#047857')),
    ]))
    st.append(t)
    st.append(Spacer(1, 16 * mm))

    valeurs = [len(D.TOUS), D.COMPTE['BLOQUANT'], D.COMPTE['MAJEUR'],
               D.COMPTE['MOYEN'], D.COMPTE['MINEUR']]
    teintes = ['#ffffff', '#fecaca', '#fed7aa', '#fde68a', '#d1fae5']
    cellules = [Paragraph(str(v), ParagraphStyle('c%d' % i, fontName='DJB', fontSize=24,
                                                 leading=28, alignment=TA_CENTER,
                                                 textColor=colors.HexColor(c)))
                for i, (v, c) in enumerate(zip(valeurs, teintes))]
    libelles = [Paragraph(x, S['couv_meta']) for x in
                ('constats', 'bloquants', 'majeurs', 'moyens', 'mineurs')]
    tt = Table([cellules, libelles], colWidths=[33.6 * mm] * 5)
    tt.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEABOVE', (0, 0), (-1, 0), 0.8, colors.HexColor('#34d399')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    st.append(tt)
    st.append(Spacer(1, 12 * mm))
    st.append(Paragraph('Lecture seule · aucun fichier du site modifié', S['couv_meta']))
    return st


class MonDoc(C.Doc):
    pass


doc = MonDoc(SORTIE, leftMargin=20 * mm, rightMargin=20 * mm,
             topMargin=17 * mm, bottomMargin=18 * mm,
             title='Study Plan IB — Audit complet', author='Audit technique',
             subject='Toutes les erreurs du site, expliquées et corrigées',
             keywords='audit, emploi du temps, pomodoro, devoirs, examens, accessibilité')

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


story = couv()
story.append(NextPageTemplate('normal'))
story.append(PageBreak())

# ── Sommaire ────────────────────────────────────────────────────────
story += C.bandeau('Sommaire')
toc = TableOfContents()
toc.levelStyles = [S['toc1']]
toc.dotsMinLevel = 0
story.append(toc)

story.append(Spacer(1, 7 * mm))
story.append(Paragraph('Les dix constats à traiter en premier', S['h2']))
story.append(P("Le document en contient %d. Ces dix-là sont ceux dont la correction change le plus "
               "visiblement le quotidien, pour le moins d’heures. Les quatre premiers sont de la "
               "sécurité : ils passent avant tout le reste." % len(D.TOUS)))
lignes = [[Paragraph('ID', S['cellb']), Paragraph('Pourquoi celui-là', S['cellb']),
           Paragraph('Effort', S['cellb'])]]
teinte = {'BLOQUANT': '#b91c1c', 'MAJEUR': '#c2410c', 'MOYEN': '#a16207', 'MINEUR': '#6b7280'}
for ident, raison, effort in D.PRIORITE:
    sev = next(i['sev'] for i in D.TOUS if i['id'] == ident)
    lignes.append([
        Paragraph(rich('**%s**' % ident), ParagraphStyle('p', fontName='DJB', fontSize=7.8,
                                                         textColor=colors.HexColor(teinte[sev]))),
        Paragraph(raison, ParagraphStyle('q', fontSize=8.1, leading=10.4, textColor=C.ENCRE)),
        Paragraph(effort, ParagraphStyle('e', fontSize=8.1, textColor=C.GRIS)),
    ])
t = Table(lignes, colWidths=[16 * mm, 132 * mm, 22 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.7, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 2.8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.8),
    ('LEFTPADDING', (0, 0), (0, -1), 2),
]))
story.append(t)

# ── Comment lire ────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Comment lire ce document')
story += C.bandeau('Comment lire ce document')
story.append(P(D.OUVERTURE))
story.append(Spacer(1, 2 * mm))
for titre, txt in D.LIRE:
    story.append(KeepTogether([Paragraph(esc(titre), S['h3']), P(txt)]))

story.append(Spacer(1, 2 * mm))
story.append(Paragraph('Répartition des constats', S['h2']))
lignes = [[Paragraph('Zone', S['cellb']), Paragraph('Constats', S['cellb']),
           Paragraph('Bloquants', S['cellb']), Paragraph('Majeurs', S['cellb'])]]
for sec in D.SECTIONS:
    nb = len(sec['items'])
    bl = sum(1 for i in sec['items'] if i['sev'] == 'BLOQUANT')
    mj = sum(1 for i in sec['items'] if i['sev'] == 'MAJEUR')
    lignes.append([Paragraph(esc(sec['titre']), S['cell']), Paragraph(str(nb), S['cell']),
                   Paragraph(str(bl) if bl else '—', S['cell']),
                   Paragraph(str(mj) if mj else '—', S['cell'])])
lignes.append([Paragraph('<b>Total</b>', S['cell']), Paragraph('<b>%d</b>' % len(D.TOUS), S['cell']),
               Paragraph('<b>%d</b>' % D.COMPTE['BLOQUANT'], S['cell']),
               Paragraph('<b>%d</b>' % D.COMPTE['MAJEUR'], S['cell'])])
t = Table(lignes, colWidths=[100 * mm, 24 * mm, 23 * mm, 23 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, -1), (-1, -1), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -2), 0.3, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3.2),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2),
]))
story.append(t)
story.append(Spacer(1, 4 * mm))

for titre, txt in D.SURVOL:
    story.append(KeepTogether([Paragraph(esc(titre), S['h3']), P(txt)]))

story.append(Spacer(1, 3 * mm))
story.append(Paragraph('Limites de cet audit', S['h2']))
for titre, txt in D.LIMITES:
    story.append(KeepTogether([Paragraph(esc(titre), S['h3']), P(txt)]))

# ── Sections ────────────────────────────────────────────────────────
for sec in D.SECTIONS:
    story.append(PageBreak())
    story += ancre(sec['titre'])
    story += C.bandeau(sec['titre'])
    story.append(P(sec['intro']))
    story.append(Spacer(1, 2.5 * mm))
    nb = len(sec['items'])
    bl = sum(1 for i in sec['items'] if i['sev'] == 'BLOQUANT')
    mj = sum(1 for i in sec['items'] if i['sev'] == 'MAJEUR')
    story.append(Paragraph(esc('%d constats · %d bloquant(s) · %d majeur(s)' % (nb, bl, mj)), S['petit']))
    story.append(Spacer(1, 3 * mm))
    for it in sec['items']:
        story += C.bloc_erreur(it)

# ── Plan de correction ──────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Plan de correction')
story += C.bandeau('Plan de correction')
story.append(P("L’ordre n’est pas négociable sur les trois premières vagues : chacune supprime un risque qui "
               "rendrait les suivantes instables. La quatrième peut être menée en parallèle si plusieurs "
               "paires de mains sont disponibles."))
story.append(Spacer(1, 3 * mm))

for v in D.PLAN:
    coul = colors.HexColor(v['couleur'])
    entete = Table([[Paragraph(rich('**%s**' % v['nom']),
                               ParagraphStyle('pn', fontName='DJB', fontSize=10.5,
                                              textColor=colors.white, alignment=TA_LEFT)),
                     Paragraph(v['duree'], ParagraphStyle('pd', fontName='DJB', fontSize=8.5,
                                                          textColor=colors.white, alignment=2))]],
                   colWidths=[125 * mm, 45 * mm])
    entete.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), coul),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    corps = Table([[P(v['texte'])]], colWidths=[170 * mm])
    corps.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(KeepTogether([entete, corps, Spacer(1, 4 * mm)]))

story.append(Spacer(1, 3 * mm))
story.append(Paragraph('Ce que cela coûte', S['h2']))
lignes = [[Paragraph('Étape', S['cellb']), Paragraph('Contenu', S['cellb']),
           Paragraph('Charge', S['cellb']), Paragraph('Calendrier', S['cellb'])]]
for nom, contenu, charge, quand, coul in D.CHIFFRAGE:
    lignes.append([Paragraph(rich('**%s**' % nom), ParagraphStyle('v', fontName='DJB', fontSize=8.3,
                                                                 textColor=colors.HexColor(coul))),
                   Paragraph(contenu, S['cell']), Paragraph(charge, S['cell']),
                   Paragraph(quand, S['cell'])])
t = Table(lignes, colWidths=[24 * mm, 88 * mm, 28 * mm, 30 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -1), 0.3, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3.3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3.3),
]))
story.append(t)
story.append(Spacer(1, 4 * mm))
story.append(P("Cent sept heures au total, dont six pour la seule sécurité. Ce chiffre compte l’écriture "
               "et la vérification, pas la concertation : chaque lot attend un accord avant d’être écrit, "
               "ce qui reste la règle de la maison."))

story.append(Spacer(1, 3 * mm))
story.append(Paragraph('Ce qu’il ne faut pas toucher', S['h2']))
for titre, txt in D.NE_PAS_TOUCHER:
    story.append(KeepTogether([Paragraph(esc(titre), S['h3']), P(txt)]))

story.append(Spacer(1, 3 * mm))
story.append(Paragraph('Questions avant d’agir', S['h2']))
for q, r in D.QUESTIONS:
    story.append(Paragraph(rich('**%s**' % q), S['corps']))
    story.append(P(r))
    story.append(Spacer(1, 1 * mm))

story.append(Spacer(1, 3 * mm))
story += C.encart('Rappel — la voix de fin de pause',
                  "Le fichier `pause-fin.wav` n’existe toujours pas : la pause se termine en silence "
                  "(PO-14). C’est la seule fonctionnalité sonore annoncée mais absente. À traiter au moment "
                  "où la voix passera au tutoiement (PO-15), dans la même séance d’enregistrement.")

# ── Annexe ──────────────────────────────────────────────────────────
story.append(PageBreak())
story += ancre('Annexe — tableau récapitulatif')
story += C.bandeau('Annexe — tableau récapitulatif')
story.append(P("Les %d constats, dans l’ordre du document. Ce tableau sert de liste de travail : on coche au "
               "fur et à mesure, et l’identifiant renvoie à la page de détail." % len(D.TOUS)))
story.append(Spacer(1, 2 * mm))

zones = {'ET': 'Emploi du temps', 'PO': 'Pomodoro', 'DE': 'Devoirs', 'AU': 'Autres pages',
         'SE': 'Sécurité', 'SY': 'Synchro', 'AC': 'Accessibilité', 'PE': 'Performance',
         'AR': 'Architecture', 'CO': 'Contenu'}
coul_sev = {'BLOQUANT': '#b91c1c', 'MAJEUR': '#c2410c', 'MOYEN': '#a16207', 'MINEUR': '#6b7280'}
lignes = [[Paragraph('ID', S['cellb']), Paragraph('Zone', S['cellb']),
           Paragraph('Gravité', S['cellb']), Paragraph('Constat', S['cellb'])]]
for sec in D.SECTIONS:
    for it in sec['items']:
        lignes.append([
            Paragraph(it['id'], ParagraphStyle('i', fontName='DJM', fontSize=7.2, textColor=C.GRIS)),
            Paragraph(zones.get(it['id'][:2], ''), ParagraphStyle('z', fontSize=7.1, textColor=C.GRIS)),
            Paragraph(it['sev'].lower(), ParagraphStyle('s', fontName='DJB', fontSize=6.5,
                                                        textColor=colors.HexColor(coul_sev[it['sev']]))),
            Paragraph(rich(it['titre']), ParagraphStyle('t', fontSize=7.6, leading=9.5,
                                                        textColor=C.ENCRE)),
        ])
t = Table(lignes, colWidths=[13 * mm, 25 * mm, 17 * mm, 115 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#059669')),
    ('LINEBELOW', (0, 1), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 2.6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fbfbfc')]),
]))
story.append(t)

story.append(Spacer(1, 6 * mm))
story += C.encart('Ce que ce document ne fait pas',
                  "Il ne modifie rien. Aucun fichier du site n’a été touché pendant l’analyse : le dépôt est "
                  "dans son état d’origine. Chaque correctif proposé attend un accord explicite avant d’être "
                  "écrit.", couleur=C.BLEU, fond=colors.HexColor('#eff6ff'))

doc.multiBuild(story)
print('PDF écrit :', SORTIE)
print('pages :', doc.page)
