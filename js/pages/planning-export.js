/* ============================================================
   Export de l'emploi du temps
   Une page A4 : une carte par jour, pastilles horaires,
   avec le prénom et la classe de l'élève.
   ============================================================ */

var EXPORT_PT_W = 595.28;
var EXPORT_PT_H = 841.89;
var EXPORT_CSS_W = 794;
var EXPORT_CSS_H = 1123;
var EXPORT_JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function exportPuceCouleur(ev) {
    var titre = String(ev && ev.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (titre.indexOf('petit') !== -1) return { bg: '#fff1e6', icon: '#fdba74' };
    if (titre.indexOf('dejeuner') !== -1) return { bg: '#f3eefe', icon: '#c4b5fd' };
    if (titre.indexOf('diner') !== -1) return { bg: '#fdeef4', icon: '#f9a8d4' };
    var map = {
        wakeup: { bg: '#fff6d6', icon: '#f6c445' },
        prep: { bg: '#fff8dc', icon: '#f5d76e' },
        transport: { bg: '#e7f8fb', icon: '#67d4e4' },
        school: { bg: '#eaf2ff', icon: '#93c5fd' },
        study: { bg: '#fff3e6', icon: '#fdba74' },
        critical: { bg: '#e8f1ff', icon: '#7aa2f7' },
        warning: { bg: '#fff6e8', icon: '#f0c27a' },
        activity: { bg: '#f3eeff', icon: '#c4b5fd' },
        phone: { bg: '#fdeef5', icon: '#f5a8c8' },
        free: { bg: '#e9f9ef', icon: '#86efac' },
        memoir: { bg: '#f1ecff', icon: '#c4b5fd' },
        ia: { bg: '#fff1f2', icon: '#fda4af' },
        sleep: { bg: '#f3f0fa', icon: '#ddd6fe' },
        meal: { bg: '#fff1e8', icon: '#fdba74' }
    };
    return map[ev && ev.type] || { bg: '#f4f6f8', icon: '#d1d5db' };
}

function exportDatesSemaine() {
    var now = new Date();
    var delta = now.getDay() === 0 ? -6 : 1 - now.getDay();
    var lundi = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
    var jours = [];
    var i;
    for (i = 0; i < 7; i++) {
        var date = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
        jours.push({ index: i, label: EXPORT_JOURS_COURT[i], num: String(date.getDate()) });
    }
    return jours;
}

function exportChargerLogo() {
    return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = 'images/logo.png?v=20261005i';
    });
}

function exportPuce(ctx, x, y, w, h, ev) {
    var couleur = exportPuceCouleur(ev);
    exportArrondi(ctx, x, y, w, h, 9);
    ctx.fillStyle = ev.plus ? '#f3f4f6' : couleur.bg;
    ctx.fill();
    var cote = h - 8;
    var ix = x + 4;
    var iy = y + 4;
    if (!ev.plus) {
        exportArrondi(ctx, ix, iy, cote, cote, 5);
        ctx.fillStyle = couleur.icon;
        ctx.fill();
        ctx.font = (cote - 3) + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ev.icon || '•', ix + cote / 2, iy + cote / 2 + 0.5);
    }
    var heure = ev.startTime || '';
    ctx.font = '600 8px Inter, sans-serif';
    var heureW = heure ? ctx.measureText(heure).width + 6 : 0;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    if (heure) ctx.fillText(heure, x + w - 6, y + h / 2);
    var titreX = ev.plus ? x + 8 : ix + cote + 5;
    var max = x + w - 6 - heureW - titreX;
    ctx.fillStyle = '#1f2937';
    ctx.font = '600 8.5px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(exportCouper(ctx, ev.title || '', Math.max(12, max)), titreX, y + h / 2);
}

function exportDessinerJour(ctx, x, y, w, h, jour) {
    ctx.save();
    ctx.shadowColor = 'rgba(16, 70, 48, 0.06)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    exportArrondi(ctx, x, y, w, h, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    exportArrondi(ctx, x, y, w, h, 16);
    ctx.strokeStyle = '#e7eeea';
    ctx.lineWidth = 1;
    ctx.stroke();

    var labelW = 52;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111827';
    ctx.font = '800 13px Inter, sans-serif';
    ctx.fillText(jour.label, x + labelW / 2, y + h / 2 - 8);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(jour.num, x + labelW / 2, y + h / 2 + 9);

    var data = exportCreneauxJour(jour.index);
    var areaX = x + labelW;
    var areaW = w - labelW - 8;
    var areaY = y + 7;
    var areaH = h - 14;
    if (data.libre) {
        ctx.fillStyle = '#be123c';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('libre', areaX + 6, y + h / 2);
        return;
    }
    var events = (data.events || []).slice().sort(function (a, b) {
        return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });
    var cols = 5;
    var gapX = 5;
    var gapY = 4;
    var chipH = 25;
    var rows = Math.max(1, Math.floor((areaH + gapY) / (chipH + gapY)));
    var max = cols * rows;
    var shown = events.slice(0, max);
    if (events.length > max && shown.length) {
        shown[shown.length - 1] = { title: '+' + (events.length - max + 1), startTime: '', icon: '', plus: true, type: 'free' };
    }
    var chipW = (areaW - gapX * (cols - 1)) / cols;
    shown.forEach(function (ev, n) {
        var col = n % cols;
        var row = Math.floor(n / cols);
        exportPuce(ctx, areaX + col * (chipW + gapX), areaY + row * (chipH + gapY), chipW, chipH, ev);
    });
}

function exportDessinerSemaine(logo) {
    var canvas = document.createElement('canvas');
    var scale = 2;
    canvas.width = EXPORT_CSS_W * scale;
    canvas.height = EXPORT_CSS_H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#eef8f3';
    ctx.fillRect(0, 0, EXPORT_CSS_W, EXPORT_CSS_H);

    var pad = 14;
    var headerH = 48;
    exportArrondi(ctx, pad, pad, EXPORT_CSS_W - pad * 2, headerH, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (logo) {
        ctx.save();
        exportArrondi(ctx, pad + 8, pad + 6, 36, 36, 10);
        ctx.clip();
        ctx.drawImage(logo, pad + 8, pad + 6, 36, 36);
        ctx.restore();
    }
    var nom = (typeof userName !== 'undefined' && userName) ? String(userName) : '';
    var classe = (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) ? ibYear : '';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111827';
    ctx.font = '700 15px Inter, sans-serif';
    var nomX = pad + (logo ? 52 : 16);
    ctx.fillText(exportCouper(ctx, nom || 'Study Plan IB', 520), nomX, pad + (classe ? 17 : headerH / 2));
    if (classe) {
        ctx.fillStyle = '#059669';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.fillText(classe, nomX, pad + 33);
    }

    var jours = exportDatesSemaine();
    var top = pad + headerH + 8;
    var gap = 6;
    var dayH = (EXPORT_CSS_H - pad - top - gap * 6) / 7;
    jours.forEach(function (jour, i) {
        exportDessinerJour(ctx, pad, top + i * (dayH + gap), EXPORT_CSS_W - pad * 2, dayH, jour);
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
    return exportChargerLogo().then(function (logo) {
        var canvas = exportDessinerSemaine(logo);
        return exportJpeg(canvas);
    }).then(function (jpeg) {
        return exportPdf([{
            jpeg: jpeg,
            pxW: EXPORT_CSS_W * 2,
            pxH: EXPORT_CSS_H * 2,
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
            document.fonts.load('700 15px Inter'),
            document.fonts.load('800 13px Inter'),
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
