/* ============================================================
   Export de l'emploi du temps
   Une page A4 paysage, lundi → dimanche, 00:00 → 24:00,
   avec le prénom, la classe et tout le programme.
   ============================================================ */

var EXPORT_PT_W = 841.89;
var EXPORT_PT_H = 595.28;
var EXPORT_CSS_W = 1123;
var EXPORT_CSS_H = 794;
var EXPORT_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function exportCouleur(type) {
    var borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    var bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f3f4f6', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#f5f3ff' };
    var colorClass = (typeof getEventColor === 'function' ? getEventColor(type) : 'border-gray-400 bg-gray-50').split(' ');
    var borderStyle = String(colorClass[0] || '').replace('border-', '').replace('-400', '').replace('-500', '');
    var bgStyle = String(colorClass[1] || '').replace('bg-', '').replace('-50', '');
    return { border: borderColorMap[borderStyle] || '#c4a48e', bg: bgColorMap[bgStyle] || '#fbf6ee' };
}

function exportArrondi(ctx, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

function exportMinutes(heure) {
    if (typeof timeToMinutes === 'function') {
        var n = timeToMinutes(heure);
        return isFinite(n) ? n : 0;
    }
    var p = String(heure || '0:0').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

function exportHorloge(mins) {
    mins = Math.round(mins);
    if (mins >= 1440) return '24:00';
    if (mins < 0) mins = 0;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function exportHeureCourte(heure) {
    if (heure === '24:00') return '24h';
    var p = String(heure || '').split(':');
    var n = parseInt(p[0], 10);
    var m = p[1] || '00';
    if (isNaN(n)) return String(heure || '');
    return n + 'h' + (m === '00' ? '' : m);
}

function exportCouper(ctx, text, max) {
    text = String(text == null ? '' : text);
    if (max <= 4) return '';
    if (ctx.measureText(text).width <= max) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text + '…';
}

function exportMots(ctx, text, max, maxLines) {
    var words = String(text || '').trim().split(/\s+/);
    var lines = [];
    var cur = '';
    var i;
    if (!words[0]) return [];
    for (i = 0; i < words.length; i++) {
        var test = cur ? cur + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width <= max) cur = test;
        else {
            if (cur) lines.push(cur);
            cur = words[i];
            if (lines.length >= maxLines) break;
        }
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (!lines.length) return [];
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = exportCouper(ctx, lines[lines.length - 1], max);
    return lines;
}

function exportPointilles(ctx, x, y, w) {
    if (w <= 2) return;
    ctx.save();
    ctx.strokeStyle = '#cbb8aa';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([1.1, 3.4]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.restore();
}

function exportJour(index) {
    var mode = (typeof holidayMode === 'function') ? holidayMode(index) : null;
    if (mode === 'free' || typeof generateDayEvents !== 'function') {
        return { mode: mode, libre: mode === 'free', events: [] };
    }
    var events = [];
    try { events = generateDayEvents(index) || []; } catch (e) { events = []; }
    events = events.filter(function (ev) { return ev && !ev.hidden && ev.startTime && ev.endTime; });
    return { mode: mode, libre: false, events: events };
}

/* Le coucher est enregistré 22:00 → 06:00 : on le montre
   le matin jusqu'au réveil, puis le soir jusqu'à minuit. */
function exportSegments(events) {
    var segs = [];
    events.forEach(function (ev) {
        var s = exportMinutes(ev.startTime);
        var e = exportMinutes(ev.endTime);
        if (e === s) return;
        if (e < s) {
            if (e > 0) segs.push({ ev: ev, start: 0, end: e, part: 'matin' });
            if (s < 1440) segs.push({ ev: ev, start: s, end: 1440, part: 'soir' });
        } else {
            segs.push({ ev: ev, start: Math.max(0, s), end: Math.min(1440, e), part: 'jour' });
        }
    });
    return segs.filter(function (seg) { return seg.end - seg.start >= 1; });
}

function exportVoies(segs) {
    segs.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var fins = [];
    segs.forEach(function (seg) {
        var i;
        for (i = 0; i < fins.length; i++) {
            if (fins[i] <= seg.start + 0.5) {
                fins[i] = seg.end;
                seg.voie = i;
                return;
            }
        }
        seg.voie = fins.length;
        fins.push(seg.end);
    });
    var n = Math.max(1, fins.length);
    segs.forEach(function (seg) { seg.voies = n; });
    return segs;
}

function exportTitre(seg) {
    if (seg.ev.id === 'sleep' && seg.part === 'matin') return 'Sommeil';
    if (seg.ev.id === 'sleep') return 'Coucher';
    return seg.ev.title || '';
}

function exportPlage(seg) {
    if (seg.part === 'matin') return '→ ' + exportHeureCourte(seg.ev.endTime);
    if (seg.part === 'soir') return exportHeureCourte(seg.ev.startTime) + ' → 24h';
    var a = exportHeureCourte(exportHorloge(seg.start));
    var b = exportHeureCourte(exportHorloge(seg.end));
    return a === b ? a : a + '–' + b;
}

function exportDessinerSemaine() {
    var jours = [];
    var i;
    for (i = 0; i < 7; i++) jours.push(exportJour(i));

    var canvas = document.createElement('canvas');
    var scale = 2;
    canvas.width = EXPORT_CSS_W * scale;
    canvas.height = EXPORT_CSS_H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var fond = ctx.createLinearGradient(0, 0, 0, EXPORT_CSS_H);
    fond.addColorStop(0, '#f8d2c2');
    fond.addColorStop(0.2, '#f6c7b4');
    fond.addColorStop(1, '#f3bba6');
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, EXPORT_CSS_W, EXPORT_CSS_H);

    var cardX = 14;
    var cardY = 12;
    var cardW = EXPORT_CSS_W - 28;
    var cardH = EXPORT_CSS_H - 24;
    ctx.save();
    ctx.shadowColor = 'rgba(120, 53, 15, 0.14)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    exportArrondi(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = '#fbf6ee';
    ctx.fill();
    ctx.restore();
    exportArrondi(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.strokeStyle = '#c9aa98';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    var encre = '#3f2c26';
    var nom = (typeof userName !== 'undefined' && userName) ? String(userName) : '';
    var classe = (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) ? ibYear : '';
    var marge = cardX + 22;
    var ligneY = cardY + 24;
    var milieu = cardX + cardW * 0.58;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = encre;
    ctx.font = '700 14px "Playfair Display", Georgia, serif';
    ctx.fillText('PRÉNOM :', marge, ligneY);
    var prenomX = marge + ctx.measureText('PRÉNOM :').width + 8;
    var prenomMax = milieu - prenomX - 18;
    if (nom) {
        ctx.font = '700 15px "Playfair Display", Georgia, serif';
        ctx.fillText(exportCouper(ctx, nom, prenomMax), prenomX, ligneY);
    } else {
        exportPointilles(ctx, prenomX, ligneY - 2, prenomMax);
    }

    ctx.font = '700 14px "Playfair Display", Georgia, serif';
    ctx.fillText('CLASSE :', milieu, ligneY);
    var classeX = milieu + ctx.measureText('CLASSE :').width + 8;
    var classeMax = cardX + cardW - 22 - classeX;
    if (classe) {
        ctx.font = '700 15px "Playfair Display", Georgia, serif';
        ctx.fillText(classe, classeX, ligneY);
    } else {
        exportPointilles(ctx, classeX, ligneY - 2, Math.max(36, classeMax));
    }

    var tableX = cardX + 12;
    var tableY = cardY + 36;
    var tableW = cardW - 24;
    var tableH = cardH - 48;
    var heureW = 46;
    var colW = (tableW - heureW) / 7;
    var headerH = 24;
    var zoneH = tableH - headerH;
    var rowH = zoneH / 24;

    function yDe(mins) {
        return tableY + headerH + (mins / 1440) * zoneH;
    }

    ctx.fillStyle = '#f7f0e6';
    ctx.fillRect(tableX, tableY, tableW, headerH);

    ctx.fillStyle = encre;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var tailleHeures = 16;
    ctx.font = '700 ' + tailleHeures + 'px Caveat, "Segoe Script", cursive';
    while (tailleHeures > 9 && ctx.measureText('Heures').width > heureW - 4) {
        tailleHeures -= 1;
        ctx.font = '700 ' + tailleHeures + 'px Caveat, "Segoe Script", cursive';
    }
    ctx.fillText('Heures', tableX + heureW / 2, tableY + headerH / 2 + 1);

    for (i = 0; i < 7; i++) {
        var cx = tableX + heureW + i * colW;
        if (jours[i].libre) {
            ctx.fillStyle = '#fff1f2';
            ctx.fillRect(cx, tableY + headerH, colW, zoneH);
        }
        var taille = 20;
        ctx.fillStyle = encre;
        ctx.font = '700 ' + taille + 'px Caveat, "Segoe Script", cursive';
        while (taille > 11 && ctx.measureText(EXPORT_JOURS[i]).width > colW - 8) {
            taille -= 1;
            ctx.font = '700 ' + taille + 'px Caveat, "Segoe Script", cursive';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(EXPORT_JOURS[i], cx + colW / 2, tableY + headerH / 2 + 1);
    }

    jours.forEach(function (jour, index) {
        if (jour.libre) return;
        var segs = exportVoies(exportSegments(jour.events));
        var colX = tableX + heureW + index * colW;
        segs.forEach(function (seg) {
            var voieW = (colW - 3) / seg.voies;
            var x = colX + 1.5 + seg.voie * voieW;
            var y = yDe(seg.start);
            var h = Math.max(2.5, yDe(seg.end) - y);
            var couleur = exportCouleur(seg.ev.type);
            ctx.fillStyle = couleur.bg;
            ctx.fillRect(x, y + 0.4, voieW - 1.5, Math.max(1.6, h - 0.8));
            ctx.fillStyle = couleur.border;
            ctx.fillRect(x, y + 0.4, 2.4, Math.max(1.6, h - 0.8));
            seg._x = x;
            seg._w = voieW - 1.5;
            seg._y = y;
            seg._h = h;
        });
        jour.segs = segs;
    });

    ctx.beginPath();
    var hour;
    for (hour = 0; hour <= 24; hour++) {
        var gy = yDe(hour * 60);
        ctx.moveTo(tableX, gy);
        ctx.lineTo(tableX + tableW, gy);
    }
    ctx.strokeStyle = '#e4d5c8';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.beginPath();
    for (hour = 0; hour <= 24; hour += 6) {
        var forte = yDe(hour * 60);
        ctx.moveTo(tableX, forte);
        ctx.lineTo(tableX + tableW, forte);
    }
    ctx.moveTo(tableX + heureW, tableY);
    ctx.lineTo(tableX + heureW, tableY + tableH);
    for (i = 1; i < 7; i++) {
        var gx = tableX + heureW + i * colW;
        ctx.moveTo(gx, tableY);
        ctx.lineTo(gx, tableY + tableH);
    }
    ctx.strokeStyle = '#c9aa98';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '600 10px Inter, sans-serif';
    for (hour = 0; hour <= 24; hour++) {
        var etiquette = exportHorloge(hour * 60);
        ctx.fillStyle = encre;
        if (hour === 24) {
            ctx.textBaseline = 'bottom';
            ctx.fillText(etiquette, tableX + heureW / 2, yDe(1440) - 1);
            ctx.textBaseline = 'top';
        } else {
            ctx.fillText(etiquette, tableX + heureW / 2, yDe(hour * 60) + 1);
        }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    jours.forEach(function (jour) {
        if (!jour.segs) return;
        var bas = [];
        jour.segs.forEach(function (seg) {
            var titre = exportTitre(seg);
            var plage = exportPlage(seg);
            var maxW = seg._w - 8;
            if (maxW < 18) return;
            var yTexte = seg._y + 1;
            if (bas[seg.voie] && bas[seg.voie] > yTexte) yTexte = bas[seg.voie];
            var place = seg._y + seg._h - yTexte;
            if (place < 11 && seg._h >= 10) {
                yTexte = seg._y + 1;
                place = seg._h - 1;
            }
            if (place < 10) return;
            var lignesMax = place >= 34 ? 3 : (place >= 22 ? 2 : 1);
            ctx.font = '700 10px Inter, sans-serif';
            var lignes = exportMots(ctx, titre, maxW, lignesMax);
            var montreHeure = place >= 22 && lignes.length < lignesMax;
            ctx.fillStyle = '#3f2c26';
            ctx.save();
            ctx.beginPath();
            ctx.rect(seg._x + 4, yTexte, maxW + 2, place);
            ctx.clip();
            var pas = 11;
            var bloc = lignes.length * pas + (montreHeure ? 10 : 0);
            var top = yTexte + Math.max(1, Math.min(Math.max(0, place - bloc) / 2, place - bloc));
            if (top < yTexte) top = yTexte;
            lignes.forEach(function (ligne, li) {
                ctx.font = '700 10px Inter, sans-serif';
                ctx.fillStyle = '#3f2c26';
                ctx.fillText(ligne, seg._x + 5, top + li * pas);
            });
            if (montreHeure) {
                ctx.font = '600 8px Inter, sans-serif';
                ctx.fillStyle = '#7c665c';
                ctx.fillText(exportCouper(ctx, plage, maxW), seg._x + 5, top + lignes.length * pas);
            }
            ctx.restore();
            bas[seg.voie] = top + bloc + 1;
        });
    });

    jours.forEach(function (jour, index) {
        if (!jour.libre) return;
        var x = tableX + heureW + index * colW + colW / 2;
        var y = tableY + headerH + zoneH / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#be123c';
        ctx.font = '500 26px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('libre', 0, 0);
        ctx.restore();
    });

    return canvas;
}

function exportBytes(parts) {
    var len = 0;
    parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len);
    var o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
}

function exportPdf(pages) {
    var enc = new TextEncoder();
    var n = pages.length;
    var parts = [];
    var size = 0;
    function add(data) {
        if (typeof data === 'string') data = enc.encode(data);
        parts.push(data);
        size += data.length;
    }
    function obj(id, chunks) {
        offsets[id] = size;
        add(id + ' 0 obj\n');
        chunks.forEach(add);
        add('\nendobj\n');
    }
    add('%PDF-1.4\n');
    var offsets = [0];
    var pagesId = 2;
    var pageIds = [];
    var contentIds = [];
    var imageIds = [];
    var i;
    for (i = 0; i < n; i++) {
        pageIds.push(3 + i);
        contentIds.push(3 + n + i);
        imageIds.push(3 + 2 * n + i);
    }
    var kids = pageIds.map(function (id) { return id + ' 0 R'; }).join(' ');
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, ['<< /Type /Pages /Count ' + n + ' /Kids [' + kids + '] >>']);
    pages.forEach(function (page, idx) {
        obj(pageIds[idx], ['<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + page.ptW.toFixed(2) + ' ' + page.ptH.toFixed(2) + '] /Contents ' + contentIds[idx] + ' 0 R /Resources << /XObject << /Im' + idx + ' ' + imageIds[idx] + ' 0 R >> >> >>']);
    });
    pages.forEach(function (page, idx) {
        var stream = 'q\n' + page.ptW.toFixed(2) + ' 0 0 ' + page.ptH.toFixed(2) + ' 0 0 cm\n/Im' + idx + ' Do\nQ';
        obj(contentIds[idx], ['<< /Length ' + enc.encode(stream).length + ' >>\nstream\n', stream, '\nendstream']);
    });
    pages.forEach(function (page, idx) {
        obj(imageIds[idx], [
            '<< /Type /XObject /Subtype /Image /Width ' + page.pxW + ' /Height ' + page.pxH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + page.jpeg.length + ' >>\nstream\n',
            page.jpeg,
            '\nendstream'
        ]);
    });
    var xref = size;
    var total = 2 + 3 * n;
    var table = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (i = 1; i <= total; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    add(table);
    add('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return exportBytes(parts);
}

function exportJpeg(canvas) {
    return new Promise(function (resolve, reject) {
        var fini = function (bytes) {
            if (!bytes || !bytes.length) reject(new Error('image vide'));
            else resolve(bytes);
        };
        if (canvas.toBlob) {
            canvas.toBlob(function (blob) {
                if (!blob) { reject(new Error('image')); return; }
                blob.arrayBuffer().then(function (buf) { fini(new Uint8Array(buf)); }).catch(reject);
            }, 'image/jpeg', 0.93);
            return;
        }
        var url = canvas.toDataURL('image/jpeg', 0.93);
        var bin = atob(url.split(',')[1]);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        fini(bytes);
    });
}

function exportSauver(bytes, nom, type) {
    var blob = new Blob([bytes], { type: type });
    var lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(function () { URL.revokeObjectURL(lien.href); }, 1500);
}

function exportPreparerPdf() {
    var canvas = exportDessinerSemaine();
    return exportJpeg(canvas).then(function (jpeg) {
        return exportPdf([{
            jpeg: jpeg,
            pxW: canvas.width,
            pxH: canvas.height,
            ptW: EXPORT_PT_W,
            ptH: EXPORT_PT_H
        }]);
    });
}

function telechargerEmploiDuTemps() {
    var btn = document.getElementById('downloadWeekBtn');
    if (btn && btn.disabled) return;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Préparation…';
    }
    var fonts = Promise.resolve();
    if (document.fonts && document.fonts.load) {
        fonts = Promise.all([
            document.fonts.load('700 15px "Playfair Display"'),
            document.fonts.load('700 20px Caveat'),
            document.fonts.ready
        ]).catch(function () { return null; });
    }
    fonts.then(exportPreparerPdf).then(function (pdf) {
        exportSauver(pdf, 'emploi-du-temps-semaine.pdf', 'application/pdf');
        if (typeof v3Toast === 'function') v3Toast('Emploi du temps complet téléchargé.', 'success');
    }).catch(function (e) {
        console.error(e);
        if (typeof v3Toast === 'function') v3Toast('Le téléchargement n’a pas pu être préparé.', 'info');
    }).then(function () {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Télécharger mon emploi du temps';
        }
    });
}
