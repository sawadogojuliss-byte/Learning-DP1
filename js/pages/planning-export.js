/* ============================================================
   Export de l'emploi du temps
   Une page A4, grille du lundi au samedi, 07:00 à 19:00,
   avec le prénom et la classe de l'élève.
   ============================================================ */

var EXPORT_PT_W = 595.28;
var EXPORT_PT_H = 841.89;
var EXPORT_CSS_W = 794;
var EXPORT_CSS_H = 1123;
var EXPORT_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
var EXPORT_HEURE_DEBUT = 7;
var EXPORT_HEURE_FIN = 19;

function exportCouleur(type) {
    var borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    var bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f9fafb', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#f5f3ff' };
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

function exportCouper(ctx, text, max) {
    text = String(text == null ? '' : text);
    if (ctx.measureText(text).width <= max) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text + '…';
}

function exportMots(ctx, text, max, maxLines) {
    var words = String(text || '').trim().split(/\s+/);
    var lines = [];
    var cur = '';
    var i;
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

function exportCreneauxJour(index) {
    var mode = (typeof holidayMode === 'function') ? holidayMode(index) : null;
    if (mode === 'free' || typeof generateDayEvents !== 'function') {
        return { mode: mode, libre: mode === 'free', events: [] };
    }
    var events = [];
    try { events = generateDayEvents(index) || []; } catch (e) { events = []; }
    events = events.filter(function (ev) { return ev && !ev.hidden; });
    return { mode: mode, libre: false, events: events };
}

function exportChevauchement(event, debut, fin) {
    if (typeof timeToMinutes !== 'function') return 0;
    var s = timeToMinutes(event.startTime);
    var e = timeToMinutes(event.endTime);
    if (e <= s) e += 1440;
    var a = Math.max(s, debut);
    var b = Math.min(e, fin);
    return Math.max(0, b - a);
}

function exportDansHeure(events, hour) {
    var debut = hour * 60;
    var fin = debut + 60;
    var hits = [];
    events.forEach(function (ev) {
        var overlap = exportChevauchement(ev, debut, fin);
        if (overlap >= 15) hits.push({ ev: ev, overlap: overlap });
    });
    hits.sort(function (a, b) { return b.overlap - a.overlap || String(a.ev.startTime).localeCompare(String(b.ev.startTime)); });
    return hits.slice(0, 2);
}

function exportEstDebut(event, hour) {
    if (typeof timeToMinutes !== 'function') return false;
    var s = timeToMinutes(event.startTime);
    return s >= hour * 60 && s < (hour + 1) * 60;
}

function exportHeureCourte(heure) {
    var n = parseInt(String(heure || '').split(':')[0], 10);
    var m = String(heure || '').split(':')[1] || '00';
    if (isNaN(n)) return heure || '';
    return n + 'h' + (m === '00' ? '' : m);
}

function exportDessinerSemaine() {
    var jours = [];
    var i;
    for (i = 0; i < 6; i++) jours.push(exportCreneauxJour(i));

    var canvas = document.createElement('canvas');
    var scale = 2;
    canvas.width = EXPORT_CSS_W * scale;
    canvas.height = EXPORT_CSS_H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var fond = ctx.createLinearGradient(0, 0, 0, EXPORT_CSS_H);
    fond.addColorStop(0, '#f8d2c2');
    fond.addColorStop(0.18, '#f6c7b4');
    fond.addColorStop(1, '#f3bba6');
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, EXPORT_CSS_W, EXPORT_CSS_H);

    var cardX = 18;
    var cardY = 22;
    var cardW = EXPORT_CSS_W - 36;
    var cardH = EXPORT_CSS_H - 40;
    exportArrondi(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.fillStyle = '#fbf6ee';
    ctx.fill();
    ctx.strokeStyle = '#c9aa98';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    var encre = '#3f2c26';
    var nom = (typeof userName !== 'undefined' && userName) ? String(userName) : '';
    var classe = (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) ? ibYear : '';
    var marge = cardX + 26;
    var ligneY = cardY + 38;
    var milieu = cardX + cardW * 0.56;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = encre;
    ctx.font = '700 15px "Playfair Display", Georgia, serif';
    ctx.fillText('PRÉNOM :', marge, ligneY);
    var prenomX = marge + ctx.measureText('PRÉNOM :').width + 10;
    var prenomMax = milieu - prenomX - 16;
    if (nom) {
        ctx.font = '700 16px "Playfair Display", Georgia, serif';
        ctx.fillText(exportCouper(ctx, nom, prenomMax), prenomX, ligneY);
    } else {
        exportPointilles(ctx, prenomX, ligneY - 2, prenomMax);
    }

    ctx.font = '700 15px "Playfair Display", Georgia, serif';
    ctx.fillText('CLASSE :', milieu, ligneY);
    var classeX = milieu + ctx.measureText('CLASSE :').width + 10;
    var classeMax = cardX + cardW - 26 - classeX;
    if (classe) {
        ctx.font = '700 16px "Playfair Display", Georgia, serif';
        ctx.fillText(classe, classeX, ligneY);
    } else {
        exportPointilles(ctx, classeX, ligneY - 2, classeMax);
    }

    var tableX = cardX + 16;
    var tableY = cardY + 58;
    var tableW = cardW - 32;
    var tableH = cardH - 76;
    var heureW = 70;
    var colW = (tableW - heureW) / 6;
    var headerH = 36;
    var rows = EXPORT_HEURE_FIN - EXPORT_HEURE_DEBUT + 1;
    var rowH = (tableH - headerH) / rows;

    ctx.strokeStyle = '#d9c7ba';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    ctx.fillStyle = encre;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 20px Caveat, "Segoe Script", cursive';
    ctx.fillText('Heures', tableX + heureW / 2, tableY + headerH / 2 + 1);
    for (i = 0; i < 6; i++) {
        var cx = tableX + heureW + i * colW;
        var taille = 22;
        ctx.fillStyle = encre;
        ctx.font = '700 ' + taille + 'px Caveat, "Segoe Script", cursive';
        while (taille > 14 && ctx.measureText(EXPORT_JOURS[i]).width > colW - 8) {
            taille -= 1;
            ctx.font = '700 ' + taille + 'px Caveat, "Segoe Script", cursive';
        }
        ctx.fillText(EXPORT_JOURS[i], cx + colW / 2, tableY + headerH / 2 + 1);
    }

    var hour;
    for (hour = EXPORT_HEURE_DEBUT; hour <= EXPORT_HEURE_FIN; hour++) {
        var row = hour - EXPORT_HEURE_DEBUT;
        var y = tableY + headerH + row * rowH;
        ctx.fillStyle = encre;
        ctx.font = '600 12px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((hour < 10 ? '0' : '') + hour + ':00', tableX + heureW / 2, y + rowH / 2);

        for (i = 0; i < 6; i++) {
            var x = tableX + heureW + i * colW;
            if (jours[i].libre) {
                ctx.fillStyle = row % 2 ? '#fff7f7' : '#fff1f2';
                ctx.fillRect(x + 0.5, y + 0.5, colW - 1, rowH - 1);
                continue;
            }
            var hits = exportDansHeure(jours[i].events, hour);
            if (!hits.length) continue;
            hits.forEach(function (hit, n) {
                var partH = rowH / hits.length;
                var py = y + n * partH;
                var couleur = exportCouleur(hit.ev.type);
                ctx.fillStyle = couleur.bg;
                ctx.fillRect(x + 1.5, py + 1.5, colW - 3, partH - 3);
                ctx.fillStyle = couleur.border;
                ctx.fillRect(x + 1.5, py + 1.5, 3, partH - 3);
                var titre = hit.ev.title || '';
                var debut = exportEstDebut(hit.ev, hour);
                var pad = 7;
                var maxW = colW - pad - 8;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#3f2c26';
                if (debut && partH >= 28) {
                    ctx.font = '700 9px Inter, sans-serif';
                    var lignes = exportMots(ctx, titre, maxW, 2);
                    var bloc = lignes.length * 11;
                    var top = py + (partH - bloc - 10) / 2;
                    lignes.forEach(function (ligne, li) {
                        ctx.fillText(ligne, x + pad, top + 6 + li * 11);
                    });
                    ctx.font = '600 8px Inter, sans-serif';
                    ctx.fillStyle = '#7c665c';
                    ctx.fillText(exportHeureCourte(hit.ev.startTime), x + pad, top + bloc + 4);
                } else {
                    ctx.font = '700 9px Inter, sans-serif';
                    var une = exportMots(ctx, titre, maxW, partH >= 32 ? 2 : 1);
                    var hTxt = une.length * 11;
                    var y0 = py + (partH - hTxt) / 2 + 5;
                    une.forEach(function (ligne, li) {
                        ctx.fillText(ligne, x + pad, y0 + li * 11);
                    });
                }
            });
        }
    }

    if (jours.some(function (j) { return j.libre; })) {
        jours.forEach(function (jour, index) {
            if (!jour.libre) return;
            var x = tableX + heureW + index * colW;
            var y = tableY + headerH + rowH * 4;
            ctx.save();
            ctx.translate(x + colW / 2, y + rowH * 2.2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#be123c';
            ctx.font = '500 28px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('libre', 0, 0);
            ctx.restore();
        });
    }

    ctx.strokeStyle = '#c9aa98';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var r;
    for (r = 0; r <= rows; r++) {
        var gy = tableY + headerH + r * rowH;
        ctx.moveTo(tableX, gy);
        ctx.lineTo(tableX + tableW, gy);
    }
    ctx.moveTo(tableX, tableY + headerH);
    ctx.lineTo(tableX + tableW, tableY + headerH);
    ctx.moveTo(tableX + heureW, tableY);
    ctx.lineTo(tableX + heureW, tableY + tableH);
    for (i = 1; i < 6; i++) {
        var gx = tableX + heureW + i * colW;
        ctx.moveTo(gx, tableY);
        ctx.lineTo(gx, tableY + tableH);
    }
    ctx.stroke();
    ctx.strokeRect(tableX, tableY, tableW, tableH);

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
            }, 'image/jpeg', 0.92);
            return;
        }
        var url = canvas.toDataURL('image/jpeg', 0.92);
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
            document.fonts.load('700 16px "Playfair Display"'),
            document.fonts.load('700 20px Caveat'),
            document.fonts.ready
        ]).catch(function () { return null; });
    }
    fonts.then(exportPreparerPdf).then(function (pdf) {
        exportSauver(pdf, 'emploi-du-temps-semaine.pdf', 'application/pdf');
        if (typeof v3Toast === 'function') v3Toast('Emploi du temps de la semaine téléchargé.', 'success');
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
