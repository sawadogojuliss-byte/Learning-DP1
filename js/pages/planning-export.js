/* ============================================================
   Export de l'emploi du temps
   Toute la semaine sur une seule page A4, avec le programme
   de chaque jour : horaires, titres et couleurs du site.
   ============================================================ */

var EXPORT_PT_W = 595.28;
var EXPORT_PT_H = 841.89;
var EXPORT_CSS_W = 794;
var EXPORT_CSS_H = 1123;

function exportCouleur(type) {
    var borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    var bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f9fafb', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#f5f3ff' };
    var colorClass = (typeof getEventColor === 'function' ? getEventColor(type) : 'border-gray-400 bg-gray-50').split(' ');
    var borderStyle = String(colorClass[0] || '').replace('border-', '').replace('-400', '').replace('-500', '');
    var bgStyle = String(colorClass[1] || '').replace('bg-', '').replace('-50', '');
    return { border: borderColorMap[borderStyle] || '#9ca3af', bg: bgColorMap[bgStyle] || '#f9fafb' };
}

function exportDureeLabel(event) {
    var mins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
    if (mins <= 0) return '';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h > 0 ? h + 'h' : '') + (m > 0 ? m + 'min' : '');
}

function exportSousTitre(event) {
    var mins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
    var subtitle = event.subtitle || '';
    if (typeof v3IsStudyType === 'function' && v3IsStudyType(event.type) && mins > 0 && typeof v3PomodoroLabel === 'function') {
        subtitle = (subtitle ? subtitle + ' · ' : '') + v3PomodoroLabel(mins);
    }
    return subtitle;
}

function exportDatesSemaine() {
    var today = new Date();
    var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }, function (_, i) {
        var date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        return {
            dayName: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
            dayNumber: date.getDate(),
            isToday: date.toDateString() === today.toDateString(),
            date: date
        };
    });
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

function exportMois(date) {
    try { return date.toLocaleDateString('fr-FR', { month: 'long' }); }
    catch (e) { return ''; }
}

function exportTitreSemaine(jours) {
    var a = jours[0].date;
    var b = jours[6].date;
    var moisA = exportMois(a);
    var moisB = exportMois(b);
    if (moisA && moisA === moisB) return 'Semaine du ' + a.getDate() + ' au ' + b.getDate() + ' ' + moisB;
    if (moisA && moisB) return 'Semaine du ' + a.getDate() + ' ' + moisA + ' au ' + b.getDate() + ' ' + moisB;
    return 'Semaine du ' + a.getDate() + '/' + (a.getMonth() + 1) + ' au ' + b.getDate() + '/' + (b.getMonth() + 1);
}

function exportFond(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ecfdf5');
    g.addColorStop(0.45, '#ffffff');
    g.addColorStop(1, '#f0fdfa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

function exportEntete(ctx, w, jours) {
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 0, w, 56);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(w, 56);
    ctx.stroke();

    var logo = ctx.createLinearGradient(16, 12, 48, 44);
    logo.addColorStop(0, '#10b981');
    logo.addColorStop(1, '#14b8a6');
    exportArrondi(ctx, 16, 12, 32, 32, 10);
    ctx.fillStyle = logo;
    ctx.fill();
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('📚', 32, 28);

    var titre = ctx.createLinearGradient(56, 0, 210, 0);
    titre.addColorStop(0, '#059669');
    titre.addColorStop(1, '#0d9488');
    ctx.textAlign = 'left';
    ctx.font = '700 15px Inter, sans-serif';
    ctx.fillStyle = titre;
    ctx.fillText('Study Plan IB', 56, 22);
    var qui = (typeof userName !== 'undefined' && userName) ? userName : '';
    var sous = exportTitreSemaine(jours);
    if (qui) sous = qui + '  ·  ' + sous;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(exportCouper(ctx, sous, w - 150), 56, 40);

    if (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) {
        ctx.font = '700 12px Inter, sans-serif';
        var tw = ctx.measureText(ibYear).width + 18;
        exportArrondi(ctx, w - 16 - tw, 16, tw, 24, 12);
        ctx.fillStyle = '#ecfdf5';
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.textAlign = 'center';
        ctx.fillText(ibYear, w - 16 - tw / 2, 28);
    }
}

function exportEvenementsJour(index) {
    var mode = (typeof holidayMode === 'function') ? holidayMode(index) : null;
    if (mode === 'free' || typeof generateDayEvents !== 'function') {
        return { mode: mode, libre: mode === 'free', events: [] };
    }
    var events = [];
    try { events = generateDayEvents(index) || []; } catch (e) { events = []; }
    events = events.filter(function (ev) { return ev && !ev.hidden; });
    if (typeof timeToMinutes === 'function') {
        events.sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
    }
    return { mode: mode, libre: false, events: events };
}

function exportHauteurJour(item, opt) {
    if (item.libre) return opt.libreH;
    var n = Math.max(item.events.length, 1);
    var rows = Math.ceil(n / opt.perRow);
    var banner = (item.mode === 'keep' || item.mode === 'light') ? opt.bannerH + opt.gapY : 0;
    return opt.pad + banner + rows * opt.chipH + (rows - 1) * opt.gapY + opt.pad;
}

function exportTotal(items, opt, gap) {
    var t = 0;
    items.forEach(function (item, i) {
        t += exportHauteurJour(item, opt);
        if (i < items.length - 1) t += gap;
    });
    return t;
}

function exportChoisirGrille(items, dispo) {
    var presets = [
        { perRow: 3, chipH: 46, gapY: 6, bannerH: 22, libreH: 58, pad: 8 },
        { perRow: 4, chipH: 40, gapY: 5, bannerH: 20, libreH: 50, pad: 8 },
        { perRow: 4, chipH: 34, gapY: 4, bannerH: 18, libreH: 44, pad: 7 },
        { perRow: 4, chipH: 28, gapY: 3, bannerH: 16, libreH: 36, pad: 6 },
        { perRow: 5, chipH: 24, gapY: 3, bannerH: 15, libreH: 32, pad: 5 },
        { perRow: 5, chipH: 18, gapY: 2, bannerH: 14, libreH: 26, pad: 4 },
        { perRow: 6, chipH: 15, gapY: 2, bannerH: 13, libreH: 22, pad: 3 }
    ];
    var opt = presets[presets.length - 1];
    var i;
    for (i = 0; i < presets.length; i++) {
        if (exportTotal(items, presets[i], 8) <= dispo) {
            opt = presets[i];
            break;
        }
    }
    var guard = 0;
    while (exportTotal(items, opt, 6) > dispo && opt.chipH > 12 && guard < 20) {
        opt = {
            perRow: opt.perRow + (opt.chipH <= 14 && opt.perRow < 7 ? 1 : 0),
            chipH: Math.max(12, opt.chipH - 1),
            gapY: 2,
            bannerH: Math.max(12, opt.bannerH - 1),
            libreH: Math.max(18, opt.libreH - 2),
            pad: Math.max(3, opt.pad - 1)
        };
        guard++;
    }
    return opt;
}

function exportPuce(ctx, event, x, y, w, h) {
    var couleur = exportCouleur(event.type);
    var rad = Math.min(8, h / 2);
    exportArrondi(ctx, x, y, w, h, rad);
    ctx.fillStyle = couleur.bg;
    ctx.fill();
    ctx.save();
    exportArrondi(ctx, x, y, w, h, rad);
    ctx.clip();
    ctx.fillStyle = couleur.border;
    ctx.fillRect(x, y, 3, h);
    ctx.restore();

    var etude = typeof v3IsStudyType === 'function' && v3IsStudyType(event.type);
    var padL = 8;
    var padR = etude && h >= 28 ? 18 : 6;
    var inner = Math.max(20, w - padL - padR);
    var titre = (event.icon ? event.icon + ' ' : '') + (event.title || 'Créneau');
    var heures = (event.startTime || '') + (event.endTime ? '–' + event.endTime : '');
    var duree = (typeof timeToMinutes === 'function') ? exportDureeLabel(event) : '';
    var meta = heures + (duree ? ' · ' + duree : '');
    var sous = (typeof timeToMinutes === 'function') ? exportSousTitre(event) : (event.subtitle || '');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (h >= 38 && sous) {
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillStyle = '#111827';
        ctx.fillText(exportCouper(ctx, titre, inner), x + padL, y + 12);
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(exportCouper(ctx, sous, inner), x + padL, y + 24);
        ctx.font = '700 8px Inter, sans-serif';
        ctx.fillStyle = couleur.border;
        ctx.fillText(exportCouper(ctx, meta, inner), x + padL, y + 35);
    } else if (h >= 26) {
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillStyle = '#111827';
        ctx.fillText(exportCouper(ctx, titre, inner), x + padL, y + h * 0.34);
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(exportCouper(ctx, meta, inner), x + padL, y + h * 0.72);
    } else {
        ctx.font = '700 8px Inter, sans-serif';
        ctx.fillStyle = '#111827';
        ctx.fillText(exportCouper(ctx, titre, inner * 0.62), x + padL, y + h / 2);
        ctx.textAlign = 'right';
        ctx.font = '7px Inter, sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(exportCouper(ctx, event.startTime || '', inner * 0.36), x + w - 5, y + h / 2);
    }
    if (etude && h >= 26) {
        ctx.font = (h >= 36 ? '11px' : '9px') + ' Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍅', x + w - 5, y + (h >= 38 ? 12 : h * 0.34));
    }
}

function exportBanniereFine(ctx, x, y, w, h, mode) {
    exportArrondi(ctx, x, y, w, h, 8);
    ctx.fillStyle = mode === 'keep' ? '#ecfdf5' : '#fff7ed';
    ctx.fill();
    ctx.strokeStyle = mode === 'keep' ? '#a7f3d0' : '#fed7aa';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = mode === 'keep' ? '#065f46' : '#9a3412';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var label = mode === 'keep' ? 'Jour férié — emploi du temps conservé' : 'Jour férié — activités retirées';
    ctx.fillText(exportCouper(ctx, label, w - 16), x + 8, y + h / 2);
}

function exportJourLibre(ctx, x, y, w, h) {
    exportArrondi(ctx, x, y, w, h, 12);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#fff1f2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,18,60,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9f1239';
    ctx.font = '700 8px Inter, sans-serif';
    ctx.fillText('JOUR FÉRIÉ', x + w / 2, y + Math.min(16, h * 0.28));
    ctx.fillStyle = '#be123c';
    ctx.font = '500 ' + Math.max(16, Math.min(28, h * 0.42)) + 'px Georgia, serif';
    ctx.fillText('libre', x + w / 2, y + h * 0.62);
}

function exportDessinerSemaine(jours) {
    var items = jours.map(function (jour, index) {
        var pack = exportEvenementsJour(index);
        pack.jour = jour;
        pack.index = index;
        return pack;
    });
    var marginX = 18;
    var top = 68;
    var bottom = 16;
    var dispo = EXPORT_CSS_H - top - bottom;
    var opt = exportChoisirGrille(items, dispo);
    var rail = 50;
    var gapX = 6;
    var zoneX = marginX + rail + 8;
    var zoneW = EXPORT_CSS_W - zoneX - marginX;
    var chipW = Math.floor((zoneW - gapX * (opt.perRow - 1)) / opt.perRow);
    var cardGap = exportTotal(items, opt, 8) <= dispo ? 8 : 6;

    var canvas = document.createElement('canvas');
    var scale = 2;
    canvas.width = EXPORT_CSS_W * scale;
    canvas.height = EXPORT_CSS_H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    exportFond(ctx, EXPORT_CSS_W, EXPORT_CSS_H);
    exportEntete(ctx, EXPORT_CSS_W, jours);

    var y = top;
    items.forEach(function (item, i) {
        var h = exportHauteurJour(item, opt);
        var cardX = marginX;
        var cardW = EXPORT_CSS_W - marginX * 2;
        exportArrondi(ctx, cardX, y, cardW, h, 12);
        ctx.fillStyle = item.jour.isToday ? '#f0fdf4' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = item.jour.isToday ? '#6ee7b7' : '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.jour.isToday ? '#047857' : '#374151';
        var railX = cardX + rail / 2;
        if (h < 36) {
            ctx.font = '700 9px Inter, sans-serif';
            ctx.fillText(item.jour.dayName + ' ' + item.jour.dayNumber, railX, y + h / 2);
        } else {
            ctx.font = '700 11px Inter, sans-serif';
            ctx.fillText(item.jour.dayName, railX, y + h / 2 - 9);
            ctx.font = '700 16px Inter, sans-serif';
            ctx.fillText(String(item.jour.dayNumber), railX, y + h / 2 + 10);
        }

        if (item.libre) {
            exportJourLibre(ctx, zoneX, y + 6, zoneW, Math.max(16, h - 12));
        } else {
            var cy = y + opt.pad;
            if (item.mode === 'keep' || item.mode === 'light') {
                exportBanniereFine(ctx, zoneX, cy, zoneW, opt.bannerH, item.mode);
                cy += opt.bannerH + opt.gapY;
            }
            if (!item.events.length) {
                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = '#9ca3af';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('Rien de prévu', zoneX, cy + opt.chipH / 2);
            }
            item.events.forEach(function (event, n) {
                var col = n % opt.perRow;
                var row = Math.floor(n / opt.perRow);
                var ex = zoneX + col * (chipW + gapX);
                var ey = cy + row * (opt.chipH + opt.gapY);
                exportPuce(ctx, event, ex, ey, chipW, opt.chipH);
            });
        }
        y += h;
        if (i < items.length - 1) y += cardGap;
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
    var jours = exportDatesSemaine();
    var canvas = exportDessinerSemaine(jours);
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
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
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
