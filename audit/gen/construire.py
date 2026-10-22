# -*- coding: utf-8 -*-
"""Mise en page du rapport d'audit Study Plan IB."""
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Frame, KeepTogether,
                                PageBreak, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle)

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

FONTES = '/usr/share/fonts/truetype/dejavu'
pdfmetrics.registerFont(TTFont('DJ', os.path.join(FONTES, 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DJB', os.path.join(FONTES, 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DJM', os.path.join(FONTES, 'DejaVuSansMono.ttf')))
registerFontFamily('DJ', normal='DJ', bold='DJB', italic='DJ', boldItalic='DJB')

import donnees as D  # noqa: E402

# ── Couleurs ────────────────────────────────────────────────────────
ENCRE = colors.HexColor('#111827')
GRIS = colors.HexColor('#4b5563')
GRIS_CLAIR = colors.HexColor('#9ca3af')
VERT = colors.HexColor('#065f46')
VERT_VIF = colors.HexColor('#059669')
FOND_VERT = colors.HexColor('#ecfdf5')
ROUGE = colors.HexColor('#b91c1c')
ROUGE_FOND = colors.HexColor('#fef2f2')
ORANGE = colors.HexColor('#c2410c')
ORANGE_FOND = colors.HexColor('#fff7ed')
AMBRE = colors.HexColor('#a16207')
AMBRE_FOND = colors.HexColor('#fffbeb')
BLEU = colors.HexColor('#1d4ed8')

SEV = {
    'BLOQUANT': (ROUGE, ROUGE_FOND),
    'MAJEUR': (ORANGE, ORANGE_FOND),
    'MOYEN': (AMBRE, AMBRE_FOND),
    'MINEUR': (colors.HexColor('#4b5563'), colors.HexColor('#f3f4f6')),
}

# ── Styles ──────────────────────────────────────────────────────────
S = {}
S['corps'] = ParagraphStyle('corps', fontName='DJ', fontSize=9.4, leading=13.6,
                            textColor=ENCRE, alignment=TA_LEFT, spaceAfter=4)
S['petit'] = ParagraphStyle('petit', fontName='DJ', fontSize=8.2, leading=11.4,
                            textColor=GRIS, alignment=TA_LEFT)
S['code'] = ParagraphStyle('code', fontName='DJM', fontSize=7.7, leading=11.2,
                           textColor=GRIS, alignment=TA_LEFT)
S['h1'] = ParagraphStyle('h1', fontName='DJB', fontSize=19, leading=23,
                         textColor=colors.white)
S['h2'] = ParagraphStyle('h2', fontName='DJB', fontSize=13.2, leading=16.5,
                         textColor=ENCRE, spaceBefore=8, spaceAfter=5,
                         alignment=TA_LEFT)
S['h3'] = ParagraphStyle('h3', fontName='DJB', fontSize=10.4, leading=13,
                         textColor=VERT, spaceBefore=6, spaceAfter=2,
                         alignment=TA_LEFT)
S['titre_err'] = ParagraphStyle('titre_err', fontName='DJB', fontSize=10.2,
                                leading=13.2, textColor=ENCRE, alignment=TA_LEFT)
S['lbl'] = ParagraphStyle('lbl', fontName='DJB', fontSize=8.1, leading=10.4,
                          textColor=GRIS, alignment=TA_LEFT, spaceBefore=2)
S['cell'] = ParagraphStyle('cell', fontName='DJ', fontSize=8.3, leading=11,
                           textColor=ENCRE, alignment=TA_LEFT)
S['cellb'] = ParagraphStyle('cellb', fontName='DJB', fontSize=8.3, leading=11,
                            textColor=ENCRE, alignment=TA_LEFT)
S['toc1'] = ParagraphStyle('toc1', fontName='DJB', fontSize=10, leading=15,
                           textColor=ENCRE, leftIndent=0)
S['centre'] = ParagraphStyle('centre', fontSize=9, leading=12, textColor=GRIS,
                             alignment=TA_CENTER)

EMOJI = {
    '\U0001F5D1': '[corbeille]', '\U0001F4C5': '[calendrier]', '\u23F1': '[chrono]',
    '\U0001F4DA': '[livres]', '\u2728': '[étoiles]', '\U0001F514': '[cloche]',
    '\U0001F4C8': '[courbe]', '\u231B': '[sablier]', '\U0001F4F7': '[appareil photo]',
    '\U0001F4DD': '[note]', '\U0001F3AF': '[cible]', '\u2705': '[coche]',
    '\U0001F4CB': '[liste]', '\U0001F512': '[cadenas]',
}


def nettoie(t):
    """Remplace les pictogrammes absents de DejaVu par leur description."""
    glyphes = pdfmetrics.getFont('DJ').face.charToGlyph
    out = []
    for ch in t:
        if ord(ch) in glyphes or ord(ch) < 32:
            out.append(ch)
        elif ch in EMOJI:
            out.append(EMOJI[ch])
        elif ch in '\u200b\u200e\u200f\ufeff':
            continue
        else:
            out.append('·')
    return ''.join(out)


def esc(t):
    t = nettoie(str(t))
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rich(t):
    """Petit balisage : **gras**, `code`, __souligné__."""
    t = esc(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'__(.+?)__', r'<font color="#047857"><b>\1</b></font>', t)
    t = re.sub(r'`(.+?)`', r'<font name="DJM" size="7.4" color="#7c2d12">\1</font>', t)
    return t


def P(t, style='corps'):
    return Paragraph(rich(t), S[style])


class Doc(BaseDocTemplate):
    def __init__(self, nom, **kw):
        BaseDocTemplate.__init__(self, nom, **kw)
        self.entrees = []

    def beforeDocument(self):
        self.entrees = []

    def afterFlowable(self, fl):
        if isinstance(fl, Paragraph) and fl.style.name == 'toc0':
            txt = fl.getPlainText().strip()
            if not txt:
                return
            cle = 'sec%d' % len(self.entrees)
            self.entrees.append((0, txt, self.page))
            self.canv.bookmarkPage(cle)
            self.canv.addOutlineEntry(txt, cle, level=0, closed=False)
            self.notify('TOCEntry', (0, txt, self.page, cle))


def fond_et_pied(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#f9fafb'))
    canvas.rect(0, 0, A4[0], 12 * mm, stroke=0, fill=1)
    canvas.setFont('DJ', 7.4)
    canvas.setFillColor(GRIS_CLAIR)
    canvas.drawString(20 * mm, 5 * mm,
                      'Audit Study Plan IB · 22 octobre 2026 · lecture seule, aucun fichier du site modifié')
    canvas.drawRightString(A4[0] - 20 * mm, 5 * mm, '%d' % doc.page)
    canvas.setStrokeColor(colors.HexColor('#e5e7eb'))
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, 12 * mm, A4[0] - 20 * mm, 12 * mm)
    canvas.restoreState()


def couverture(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#065f46'))
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor('#047857'))
    canvas.circle(A4[0] - 30 * mm, A4[1] - 40 * mm, 55 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor('#059669'))
    canvas.circle(35 * mm, 45 * mm, 40 * mm, stroke=0, fill=1)
    canvas.restoreState()


def bandeau(titre, num=None):
    t = Table([[Paragraph(esc(titre), S['h1'])]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#065f46')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return [Spacer(1, 2 * mm), t, Spacer(1, 5 * mm)]


def bloc_erreur(it):
    """Carte de constat : en-tête répété, rubriques insécables, coupe aux frontières."""
    sev = it['sev']
    coul, fond = SEV[sev]
    st_id = ParagraphStyle('bid', fontName='DJB', fontSize=8.4, textColor=colors.white)
    st_sv = ParagraphStyle('bsv', fontName='DJB', fontSize=6.6, textColor=colors.white)

    def para(genre, txt):
        if genre == 'lab':
            return Paragraph(txt, S['lbl'])
        if genre == 'code':
            return P(txt, 'code')
        if genre == 'petit':
            return Paragraph(rich(txt), S['petit'])
        return P(txt)

    solution = [('lab', 'SOLUTION DURABLE'), ('txt', it['fix'])]
    if it.get('effort'):
        solution.append(('petit', '**Effort :** ' + it['effort']))
    rubriques = [
        [('lab', 'OÙ'), ('code', it['ou'])],
        [('lab', 'CE QUI SE PASSE'), ('txt', it['constat'])],
        [('lab', 'POURQUOI C’EST UN PROBLÈME'), ('txt', it['impact'])],
        solution,
    ]

    lignes = [[Paragraph(esc(it['id']), st_id),
               Paragraph(esc(sev), st_sv),
               Paragraph(rich(it['titre']), S['titre_err'])]]
    for rub in rubriques:
        lignes.append([[para(g, t) for g, t in rub], '', ''])

    n = len(lignes)
    styles = [
        ('BACKGROUND', (0, 0), (0, 0), coul),
        ('BACKGROUND', (1, 0), (1, 0), coul),
        ('BACKGROUND', (2, 0), (2, 0), fond),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('LEFTPADDING', (0, 0), (0, 0), 6),
        ('LEFTPADDING', (2, 0), (2, 0), 7),
        ('TOPPADDING', (0, 0), (-1, 0), 5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 0.7, coul),
        ('LINEBEFORE', (0, 0), (0, -1), 2.6, coul),
        ('BOX', (0, 1), (-1, -1), 0.55, colors.HexColor('#e5e7eb')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('LEFTPADDING', (0, 1), (-1, -1), 9),
        ('RIGHTPADDING', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (0, 1), 2),
        ('BOTTOMPADDING', (0, 1), (0, -1), 2),
    ]
    for r in range(1, n):
        styles.append(('SPAN', (0, r), (-1, r)))
    styles.append(('BOTTOMPADDING', (0, n - 1), (-1, n - 1), 6))

    t = Table(lignes, colWidths=[17 * mm, 20 * mm, 133 * mm], repeatRows=1)
    t.setStyle(TableStyle(styles))
    return [CondPageBreak(52 * mm), t, Spacer(1, 3.4 * mm)]


def encart(titre, corps, couleur=VERT_VIF, fond=FOND_VERT):
    t = Table([[
        Paragraph('<font color="%s"><b>%s</b></font>'
                  % (couleur.hexval().replace('0x', '#'), esc(titre)),
                  ParagraphStyle('e', fontName='DJB', fontSize=9, leading=12.5,
                                 textColor=couleur)),
    ], [P(corps)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fond),
        ('LINEBEFORE', (0, 0), (0, -1), 3, couleur),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (0, 0), 6),
        ('BOTTOMPADDING', (0, 0), (0, 0), 2),
        ('TOPPADDING', (0, 1), (0, 1), 1),
        ('BOTTOMPADDING', (0, 1), (0, 1), 7),
    ]))
    return [Spacer(1, 2 * mm), t, Spacer(1, 4 * mm)]
