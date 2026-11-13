        (function() {
            var $ = function(i) {
                return document.getElementById(i)
            };
            var src = $('src'),
                out = $('out'),
                msg = $('msg'),
                dmsg = $('dmsg'),
                tables = [],
                pastedHtml = '';

            function setMsg(t, e) {
                msg.textContent = t;
                msg.className = 'msg ' + (e ? 'err' : 'hint')
            }

            src.addEventListener('paste', function(e) {
                var h = e.clipboardData && e.clipboardData.getData('text/html');
                pastedHtml = (h && /<table/i.test(h)) ? h : '';
                setTimeout(extract, 0);
            });

            function fromHtml(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html'),
                    res = [];
                doc.querySelectorAll('table').forEach(function(t) {
                    if (t.querySelector('table')) return; // skip layout wrappers
                    var rows = [],
                        span = [];
                    t.querySelectorAll('tr').forEach(function(tr, r) {
                        var row = rows[r] || (rows[r] = []),
                            c = 0;
                        tr.querySelectorAll('th,td').forEach(function(cell) {
                            while (row[c] !== undefined) c++;
                            var txt = cell.textContent.replace(/\s+/g, ' ').trim(),
                                cs = parseInt(cell.getAttribute('colspan')) || 1,
                                rs = parseInt(cell.getAttribute('rowspan')) || 1;
                            for (var i = 0; i < rs; i++) {
                                var rr = rows[r + i] || (rows[r + i] = []);
                                for (var j = 0; j < cs; j++) {
                                    rr[c + j] = (i === 0 && j === 0) ? txt : ''
                                }
                            }
                            c += cs;
                        });
                    });
                    rows = rows.filter(function(r) {
                        return r && r.some(function(v) {
                            return v
                        })
                    });
                    if (rows.length) {
                        var cap = t.querySelector('caption');
                        res.push({
                            name: cap ? cap.textContent.trim() : '',
                            rows: rows
                        });
                    }
                });
                return res;
            }

            function fromText(txt) {
                var lines = txt.split(/\r?\n/).filter(function(l) {
                    return l.trim()
                });
                if (!lines.length) return [];
                var d = lines.some(function(l) {
                    return l.indexOf('\t') > -1
                }) ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
                var rows = lines.map(function(l) {
                    var o = [],
                        cur = '',
                        q = false;
                    for (var i = 0; i < l.length; i++) {
                        var ch = l[i];
                        if (ch === '"') {
                            if (q && l[i + 1] === '"') {
                                cur += '"';
                                i++
                            } else q = !q
                        } else if (ch === d && !q) {
                            o.push(cur);
                            cur = ''
                        } else cur += ch
                    }
                    o.push(cur);
                    return o.map(function(v) {
                        return v.trim()
                    });
                });
                return rows.length > 1 || rows[0].length > 1 ? [{
                    name: '',
                    rows: rows
                }] : [];
            }

            function extract() {
                var txt = src.value;
                if (!txt.trim()) {
                    tables = [];
                    render();
                    return
                }
                var found = [];
                if (pastedHtml) found = fromHtml(pastedHtml);
                if (!found.length && /<table/i.test(txt)) found = fromHtml(txt);
                if (!found.length) found = fromText(txt);
                pastedHtml = '';
                tables = found.map(function(t, i) {
                    t.on = true;
                    t.name = t.name || ('Table ' + (i + 1));
                    return t
                });
                render();
                setMsg(tables.length ? ('Found ' + tables.length + ' table' + (tables.length > 1 ? 's' : '') + '.') : 'No tables found. Paste a copied table, page HTML, or CSV text.', !tables.length);
            }

            function render() {
                out.innerHTML = '';
                if (!tables.length) {
                    out.innerHTML = '<div class="empty">No tables yet.</div>'
                }
                tables.forEach(function(t, i) {
                    var box = document.createElement('div');
                    box.className = 'tbl';
                    var h = document.createElement('div');
                    h.className = 'tbl-h';
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = t.on;
                    cb.onchange = function() {
                        t.on = cb.checked;
                        btns()
                    };
                    var nm = document.createElement('input');
                    nm.type = 'text';
                    nm.value = t.name;
                    nm.maxLength = 31;
                    nm.oninput = function() {
                        t.name = nm.value
                    };
                    var info = document.createElement('span');
                    info.className = 'hint';
                    info.textContent = t.rows.length + ' rows × ' + Math.max.apply(null, t.rows.map(function(r) {
                        return r.length
                    })) + ' cols';
                    h.append(cb, nm, info);
                    var sc = document.createElement('div');
                    sc.className = 'scroll';
                    var tb = document.createElement('table');
                    t.rows.slice(0, 50).forEach(function(r, ri) {
                        var tr = document.createElement('tr');
                        r.forEach(function(v) {
                            var c = document.createElement(ri === 0 ? 'th' : 'td');
                            c.textContent = v;
                            tr.appendChild(c)
                        });
                        tb.appendChild(tr);
                    });
                    sc.appendChild(tb);
                    box.append(h, sc);
                    if (t.rows.length > 50) {
                        var m = document.createElement('div');
                        m.className = 'hint';
                        m.style.padding = '6px 12px';
                        m.textContent = 'Preview shows the first 50 rows; the file will contain all ' + t.rows.length + '.';
                        box.appendChild(m)
                    }
                    out.appendChild(box);
                });
                btns();
            }

            function btns() {
                var n = tables.some(function(t) {
                    return t.on
                });
                $('dlx').disabled = !n;
                $('dlc').disabled = !n
            }

            function cellVal(v) {
                if (v !== '' && /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v)) return Number(v);
                return v;
            }

            function uniq(name, used) {
                var n = (name || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31) || 'Sheet',
                    b = n,
                    k = 2;
                while (used[n.toLowerCase()]) {
                    var s = ' (' + k++ + ')';
                    n = b.slice(0, 31 - s.length) + s
                }
                used[n.toLowerCase()] = 1;
                return n;
            }

            async function save(filename, data) {
                dmsg.textContent = '';
                try {
                    var d = await claude.use('downloads');
                    if (!d) {
                        dmsg.textContent = 'Saving is not available in this view. Open the page in claude.ai to download.';
                        return
                    }
                    var r = await d.save({
                        filename: filename,
                        data: data
                    });
                    dmsg.textContent = r.status === 'saved' ? 'Saved ✓' : '';
                } catch (e) {
                    if (e && e.code === 'declined') return;
                    dmsg.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error');
                }
            }

            $('dlx').onclick = function() {
                var wb = XLSX.utils.book_new(),
                    used = {};
                tables.filter(function(t) {
                    return t.on
                }).forEach(function(t) {
                    var ws = XLSX.utils.aoa_to_sheet(t.rows.map(function(r) {
                        return r.map(cellVal)
                    }));
                    var w = [];
                    t.rows.forEach(function(r) {
                        r.forEach(function(v, i) {
                            w[i] = Math.min(60, Math.max(w[i] || 8, String(v).length + 2))
                        })
                    });
                    ws['!cols'] = w.map(function(x) {
                        return {
                            wch: x
                        }
                    });
                    XLSX.utils.book_append_sheet(wb, ws, uniq(t.name, used));
                });
                var buf = XLSX.write(wb, {
                    bookType: 'xlsx',
                    type: 'array'
                });
                save('web-to-excel.xlsx', new Blob([buf]));
            };
            $('dlc').onclick = function() {
                var t = tables.filter(function(t) {
                    return t.on
                })[0];
                if (!t) return;
                var csv = t.rows.map(function(r) {
                    return r.map(function(v) {
                        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
                    }).join(',')
                }).join('\r\n');
                save('web-to-excel.csv', '\uFEFF' + csv);
            };

            $('go').onclick = function() {
                pastedHtml = '';
                extract()
            };
            $('clear').onclick = function() {
                src.value = '';
                tables = [];
                render();
                setMsg('Cleared.')
            };
            $('file').onchange = function(e) {
                var f = e.target.files[0];
                if (!f) return;
                var rd = new FileReader();
                rd.onload = function() {
                    src.value = rd.result;
                    pastedHtml = '';
                    extract()
                };
                rd.readAsText(f);
                e.target.value = '';
            };
        })();