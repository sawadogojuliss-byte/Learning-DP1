/* ============================================================
   Export de l'emploi du temps
   Toute la semaine, une page par jour, même forme que le site :
   bandeau, pastilles des jours, cartes colorées, heures à droite.
   ============================================================ */

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

function exportFond(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ecfdf5');
    g.addColorStop(0.45, '#ffffff');
    g.addColorStop(1, '#f0fdfa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

function exportBandeau(ctx, w) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 0, w, 76);
    ctx.restore();
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 76);
    ctx.lineTo(w, 76);
    ctx.stroke();

    var logo = ctx.createLinearGradient(16, 18, 56, 58);
    logo.addColorStop(0, '#10b981');
    logo.addColorStop(1, '#14b8a6');
    exportArrondi(ctx, 16, 18, 40, 40, 12);
    ctx.fillStyle = logo;
    ctx.fill();
    ctx.font = '22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('📚', 36, 39);

    var titre = ctx.createLinearGradient(68, 0, 230, 0);
    titre.addColorStop(0, '#059669');
    titre.addColorStop(1, '#0d9488');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.fillStyle = titre;
    ctx.fillText('Study Plan IB', 68, 36);
    var salut = (typeof getGreeting === 'function' ? getGreeting() : 'Bonjour') + ', ' + ((typeof userName !== 'undefined' && userName) ? userName : 'là') + ' !';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(salut, 68, 58);

    if (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) {
        ctx.font = '700 13px Inter, sans-serif';
        var label = ibYear;
        var tw = ctx.measureText(label).width + 22;
        exportArrondi(ctx, w - 16 - tw, 24, tw, 28, 14);
        ctx.fillStyle = '#ecfdf5';
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w - 16 - tw / 2, 38);
    }
}

function exportPastilles(ctx, w, jours, actif) {
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 76, w, 78);
    ctx.strokeStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.moveTo(0, 154);
    ctx.lineTo(w, 154);
    ctx.stroke();
    var gap = 6;
    var x0 = 12;
    var largeur = (w - 24 - gap * 6) / 7;
    jours.forEach(function (jour, i) {
        var x = x0 + i * (largeur + gap);
        var on = i === actif;
        exportArrondi(ctx, x, 86, largeur, 56, 12);
        if (on) {
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = 'rgba(16,185,129,0.35)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
        } else if (jour.isToday) {
            ctx.fillStyle = '#d1fae5';
            ctx.fill();
            ctx.fillStyle = '#047857';
        } else {
            ctx.fillStyle = '#f3f4f6';
            ctx.fill();
            ctx.fillStyle = '#4b5563';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillText(jour.dayName, x + largeur / 2, 104);
        ctx.font = '700 18px Inter, sans-serif';
        ctx.fillText(String(jour.dayNumber), x + largeur / 2, 126);
    });
}

function exportCarteDessin(ctx, event, x, y, w) {
    var couleur = exportCouleur(event.type);
    var h = 72;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    exportArrondi(ctx, x, y, w, h, 14);
    ctx.fillStyle = couleur.bg;
    ctx.fill();
    ctx.restore();
    ctx.save();
    exportArrondi(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.fillStyle = couleur.border;
    ctx.fillRect(x, y, 4, h);
    ctx.restore();

    exportArrondi(ctx, x + 16, y + 14, 44, 44, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111827';
    ctx.fillText(event.icon || '📌', x + 38, y + 37);

    var etude = typeof v3IsStudyType === 'function' && v3IsStudyType(event.type);
    var droite = x + w - 16 - 18;
    var tempsX = droite - 78;
    if (etude) tempsX -= 40;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 13.6px Inter, sans-serif';
    ctx.fillStyle = '#374151';
    var debut = (event.kind === 'pinned' ? '📌 ' : '') + (event.startTime || '');
    ctx.fillText(debut, droite, y + 28);
    ctx.font = '11.2px Inter, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('→ ' + (event.endTime || ''), droite, y + 44);
    var duree = exportDureeLabel(event);
    if (duree) {
        ctx.font = '600 10.8px Inter, sans-serif';
        ctx.fillStyle = couleur.border;
        ctx.fillText(duree, droite, y + 60);
    }
    if (etude) {
        exportArrondi(ctx, tempsX + 78 - 36, y + 20, 32, 32, 16);
        ctx.fillStyle = '#fef2f2';
        ctx.fill();
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = '16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍅', tempsX + 78 - 20, y + 37);
    }

    var texteX = x + 74;
    var texteMax = Math.max(40, tempsX - texteX - 8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 14.4px Inter, sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText(exportCouper(ctx, event.title || '', texteMax), texteX, y + (exportSousTitre(event) ? 32 : 40));
    var sous = exportSousTitre(event);
    if (sous) {
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(exportCouper(ctx, sous, texteMax), texteX, y + 52);
    }
    return h;
}

function exportLibreDessin(ctx, x, y, w) {
    var carteW = Math.min(296, w - 32);
    var carteH = 460;
    var cx = x + (w - carteW) / 2;
    exportArrondi(ctx, cx, y, carteW, carteH, 32);
    var g = ctx.createLinearGradient(cx, y, cx, y + carteH);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#fff1f2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,18,60,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    exportArrondi(ctx, cx + 14, y + 14, carteW - 28, carteH - 28, 22);
    ctx.strokeStyle = 'rgba(190,18,60,0.16)';
    ctx.stroke();
    ctx.fillStyle = '#9f1239';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JOUR FÉRIÉ', cx + carteW / 2, y + 42);
    ctx.save();
    ctx.translate(cx + carteW / 2, y + carteH / 2 + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#be123c';
    ctx.font = '500 78px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('libre', 0, 0);
    ctx.restore();
    ctx.strokeStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(cx + carteW / 2 - 19, y + carteH - 36);
    ctx.lineTo(cx + carteW / 2 + 19, y + carteH - 36);
    ctx.stroke();
    return carteH;
}

function exportBanniere(ctx, x, y, w, mode) {
    var h = 42;
    exportArrondi(ctx, x, y, w, h, 14);
    if (mode === 'keep') {
        ctx.fillStyle = '#ecfdf5';
        ctx.fill();
        ctx.strokeStyle = '#a7f3d0';
        ctx.stroke();
        ctx.fillStyle = '#065f46';
        ctx.font = '600 13.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉  Jour férié — emploi du temps conservé', x + 14, y + 21);
    } else {
        ctx.fillStyle = '#fff7ed';
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.stroke();
        ctx.fillStyle = '#9a3412';
        ctx.font = '600 13.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉  Jour férié — activités désélectionnées retirées', x + 14, y + 21);
    }
    return h;
}

function exportDessinerJour(index, jours) {
    var w = 820;
    var x = 16;
    var carteW = w - 32;
    var mode = (typeof holidayMode === 'function') ? holidayMode(index) : null;
    var libre = mode === 'free';
    var events = libre ? [] : generateDayEvents(index);
    var y = 154 + 18;
    var hauteur = y + 24;
    if (libre) hauteur += 460;
    else {
        if (mode === 'keep' || mode === 'light') hauteur += 42 + 12;
        hauteur += Math.max(1, events.length) * 82;
    }
    var canvas = document.createElement('canvas');
    var scale = 2;
    canvas.width = w * scale;
    canvas.height = hauteur * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'alphabetic';
    exportFond(ctx, w, hauteur);
    exportBandeau(ctx, w);
    exportPastilles(ctx, w, jours, index);
    if (libre) {
        exportLibreDessin(ctx, x, y, carteW);
    } else {
        if (mode === 'keep' || mode === 'light') y += exportBanniere(ctx, x, y, carteW, mode) + 12;
        events.forEach(function (event) {
            exportCarteDessin(ctx, event, x, y, carteW);
            y += 82;
        });
    }
    return { canvas: canvas, cssW: w, cssH: hauteur };
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
    var dessins = jours.map(function (_, index) { return exportDessinerJour(index, jours); });
    return Promise.all(dessins.map(function (dessin) {
        return exportJpeg(dessin.canvas).then(function (jpeg) {
            return { jpeg: jpeg, pxW: dessin.canvas.width, pxH: dessin.canvas.height, ptW: dessin.cssW * 0.75, ptH: dessin.cssH * 0.75 };
        });
    })).then(exportPdf);
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
