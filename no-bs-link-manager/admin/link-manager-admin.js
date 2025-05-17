jQuery(document).ready(function($) {
    // Inject modal HTML once on page load if not already present
    if (!$('#wplm-modal').length) {
        $('body').append(`
          <div id="wplm-modal-bg" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);z-index:9999;"></div>
          <div id="wplm-modal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);min-width:360px;max-width:90vw;max-height:95vh;overflow:auto;background:#fff;padding:28px 28px 18px 28px;border-radius:14px;box-shadow:0 6px 32px 0 rgba(60,60,70,.25);z-index:10000;">
          </div>
        `);
    }

    let currentPage = 1;
    const pageSize = 25;
    let allLinks = [];
    let lastSearch = '';
    let linkStatusCache = {}; // Cache for link HTTP status

    // HTTP status reason phrases
    const STATUS_DESC = {
        '200': 'OK',
        '301': 'Moved Permanently',
        '302': 'Found',
        '401': 'Unauthorized',
        '403': 'Forbidden',
        '404': 'Not Found',
        '406': 'Not Acceptable',
        '500': 'Server Error',
        'ERR': 'Connection Failed'
    };

    // Simple icon for internal/external
    function getLinkTypeIcon(href) {
        if (!href) return '';
        let isInternal = (
            href.indexOf(location.origin) === 0 ||
            (href.startsWith('/') && !href.startsWith('//')) ||
            href.indexOf(document.domain) >= 0
        );
        return isInternal
            ? '<span title="Internal" style="color:green;font-weight:bold;">●</span>'
            : '<span title="External" style="color:#d00;font-size:17px;">↗</span>';
    }

    // Toast notification
    function showToast(msg) {
        let $toast = $('<div style="position:fixed;bottom:30px;right:30px;background:#323232;color:#fff;padding:12px 22px;border-radius:8px;z-index:9999;font-size:16px;">'+msg+'</div>');
        $('body').append($toast);
        setTimeout(() => $toast.fadeOut(400, function(){ $(this).remove(); }), 1800);
    }

    // HTTP status checker
    function checkLinkStatus(href, cb) {
        if (!href) return cb('');
        if (linkStatusCache[href]) return cb(linkStatusCache[href]);
        // Internal links: use HEAD directly
        if ((href.startsWith('/') && !href.startsWith('//')) || href.indexOf(location.origin) === 0) {
            $.ajax({
                url: href.startsWith('/') ? href : href.replace(location.origin, ''),
                type: 'HEAD',
                complete: function(xhr) {
                    let status = xhr.status ? xhr.status.toString() : 'ERR';
                    linkStatusCache[href] = status;
                    cb(status);
                },
                error: function(xhr) {
                    let status = xhr && xhr.status ? xhr.status.toString() : 'ERR';
                    linkStatusCache[href] = status;
                    cb(status);
                }
            });
        } else {
            // External: use public CORS proxy (AllOrigins) for HTTP status (good for dev/small use)
            let proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(href);
            $.ajax({
                url: proxy,
                type: 'GET',
                success: function(data, status, xhr) {
                    let st = (data && data.status && data.status.http_code) ? data.status.http_code : xhr.status;
                    st = st ? st.toString() : '200';
                    linkStatusCache[href] = st;
                    cb(st);
                },
                error: function(xhr) {
                    let status = xhr && xhr.status ? xhr.status.toString() : 'ERR';
                    linkStatusCache[href] = status;
                    cb(status);
                }
            });
        }
    }

    // Setup the UI once
    function initializeLinkManagerUI() {
        $('#no-bs-link-manager-app').html(`
            <div style="margin-bottom:16px;">
                <input type="text" id="wplm-search" placeholder="Search anchor or URL..." style="min-width:240px;" autocomplete="off" />
            </div>
            <div id="wplm-table-container"></div>
            <div id="wplm-pagination-container"></div>
        `);
        $('#wplm-search').on('input', function() {
            lastSearch = $(this).val();
            applySearchAndRender();
        });
    }

    function applySearchAndRender() {
        let val = lastSearch.toLowerCase();
        let filtered = allLinks.filter(link =>
            (link.anchor && link.anchor.toLowerCase().includes(val)) ||
            (link.href && link.href.toLowerCase().includes(val))
        );
        currentPage = 1;
        renderTable(filtered);
        $('#wplm-search').val(lastSearch).focus();
    }

    function fetchLinks(cb) {
        $('#no-bs-link-manager-app').html('<p>Loading links...</p>');
        $.ajax({
            url: WPLM.rest_url + 'links',
            method: 'GET',
            headers: {'X-WP-Nonce': WPLM.nonce},
            success: function(data) {
                allLinks = data;
                currentPage = 1;
                lastSearch = '';
                initializeLinkManagerUI();
                renderTable(allLinks);
                if (cb) cb();
            },
            error: function() {
                $('#no-bs-link-manager-app').html('<p>Error loading links.</p>');
            }
        });
    }

    function paginateLinks(links) {
        let totalPages = Math.ceil(links.length / pageSize);
        let start = (currentPage - 1) * pageSize;
        let end = start + pageSize;
        let pagedLinks = links.slice(start, end);
        return { pagedLinks, totalPages };
    }

    function renderTable(links) {
        let { pagedLinks, totalPages } = paginateLinks(links);

        let html = '';
        if (!links.length) {
            html = '<p>No links found. <span style="color:#36c;cursor:pointer;text-decoration:underline;" id="wplm-clear-search">Clear search</span></p>';
            $('#wplm-table-container').html(html);
            $('#wplm-pagination-container').html('');
            $('#wplm-clear-search').on('click', function() {
                lastSearch = '';
                $('#wplm-search').val('');
                currentPage = 1;
                renderTable(allLinks);
                $('#wplm-search').focus();
            });
            return;
        }

        html = '<table class="widefat fixed striped"><thead><tr>' +
            '<th>Type</th><th>Status</th><th>Anchor</th><th>URL</th><th>Attributes</th><th>Found In</th><th>Excerpt</th><th></th></tr></thead><tbody>';
        pagedLinks.forEach(function(link, i) {
    // Build human-readable attributes:
    let attrs = [];
let rel = (link.attrs.rel || "").split(" ");
if (rel.includes("nofollow")) {
    attrs.push('<span class="attr-badge attr-nofollow">nofollow</span>');
} else {
    attrs.push('<span class="attr-badge attr-dofollow">dofollow</span>');
}
if (rel.includes("sponsored")) {
    attrs.push('<span class="attr-badge attr-sponsored">sponsored</span>');
}
if (rel.includes("ugc")) {
    attrs.push('<span class="attr-badge attr-UGC">UGC</span>');
}
if (link.attrs.target === "_blank") {
    attrs.push('<span class="attr-badge attr-newtab">open in new tab</span>');
} else {
    attrs.push('<span class="attr-badge attr-newtab">open in same tab</span>');
}


    let foundIn = '';
    if (link.permalink) {
        let relUrl = link.permalink.replace(/^https?:\/\/[^\/]+/i, '');
        foundIn = '<a href="' + escapeHtml(link.permalink) + '" target="_blank" rel="noopener">' +
                  escapeHtml(relUrl) + '</a>';
    } else {
        foundIn = '<span style="color:#888">n/a</span>';
    }
    let tableIndex = (i + (currentPage - 1) * pageSize);
    let linkTypeIcon = getLinkTypeIcon(link.href);

    // Render table row
    html += '<tr data-index="' + tableIndex + '">' +
        `<td class="link-type" style="text-align:center;">${linkTypeIcon}</td>` +
        `<td class="link-status" data-href="${escapeHtml(link.href)}" id="status-${tableIndex}" style="text-align:center;">…</td>` +
        '<td class="anchor">' + escapeHtml(link.anchor) + '</td>' +
        '<td class="href"><a href="' + escapeHtml(link.href) + '" target="_blank" rel="noopener">' +
            escapeHtml(link.href) + '</a></td>' +
        '<td class="attrs">' + attrs.join('<br>') + '</td>' +
        '<td>' + foundIn + '</td>' +
        '<td style="max-width:320px;">' + escapeHtml(link.context) + '</td>' +
        '<td><button class="wplm-edit-link button button-small" data-index="' + tableIndex + '">Edit</button></td>' +
        '</tr>';
});

        html += '</tbody></table>';
        $('#wplm-table-container').html(html);

        // HTTP Status async update
        pagedLinks.forEach(function(link, i) {
            let tableIndex = (i + (currentPage - 1) * pageSize);
            let cell = $('#status-' + tableIndex);
            cell.text('…');
            checkLinkStatus(link.href, function(status) {
                let desc = STATUS_DESC[status] || '';
                let display = status;
                if (desc) display += ': ' + desc;
                if (status === '200') {
                    cell.html('<span style="color:green;">' + display + '</span>');
                } else if (status === '301' || status === '302') {
                    cell.html('<span style="color:#D2691E;">' + display + '</span>');
                } else if (status === '404' || status === 'ERR') {
                    cell.html('<span style="color:#d00;font-weight:bold;">' + display + '</span>');
                } else if (status === '403' || status === '406' || status === '401') {
                    cell.html('<span style="color:#888;font-weight:bold;">' + display + '</span>');
                } else {
                    cell.text(display);
                }
            });
        });

        // Pagination controls
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = '<div style="margin:12px 0;">';
            if (currentPage > 1)
                paginationHtml += `<button id="wplm-prev-page">Previous</button>`;
            paginationHtml += ` Page ${currentPage} of ${totalPages} `;
            if (currentPage < totalPages)
                paginationHtml += `<button id="wplm-next-page">Next</button>`;
            paginationHtml += '</div>';
        }
        $('#wplm-pagination-container').html(paginationHtml);

        // Pagination handlers
        $('#wplm-prev-page').on('click', function() {
            currentPage--;
            renderTable(getCurrentFilteredLinks());
            scrollToTopOfTable();
        });
        $('#wplm-next-page').on('click', function() {
            currentPage++;
            renderTable(getCurrentFilteredLinks());
            scrollToTopOfTable();
        });

        // Attach edit button handler (calls the modal version)
        $('.wplm-edit-link').on('click', function() {
            let index = $(this).data('index');
            let links = getCurrentFilteredLinks();
            showEditModal(links[index], index);
        });
    }

    // MODAL EDITOR
    function showEditModal(link, index) {
        let attrs = link.attrs || {};
        let rel = attrs.rel ? attrs.rel.split(' ') : [];
        let relType = rel.includes('nofollow') ? 'nofollow' : 'dofollow';
        let sponsored = rel.includes('sponsored');
        let ugc = rel.includes('ugc');
        let target = attrs.target || '';

        // Modal content
        let modalHtml = `
            <h2 style="margin-top:0;font-size:22px;">Edit Link</h2>
            <div style="margin-bottom:18px;">
                <label><b>Anchor</b><br>
                    <input type="text" class="edit-anchor" value="${escapeAttr(link.anchor)}" style="width:98%;margin-top:2px;">
                </label>
            </div>
            <div style="margin-bottom:18px;">
                <label><b>URL</b><br>
                    <input type="text" class="edit-href" value="${escapeAttr(link.href)}" style="width:98%;margin-top:2px;">
                </label>
            </div>
            <div style="margin-bottom:18px;">
                <label><b>rel</b>:
                    <select class="edit-rel-type" style="margin-left:8px;">
                        <option value="dofollow"${relType === 'dofollow' ? ' selected' : ''}>dofollow</option>
                        <option value="nofollow"${relType === 'nofollow' ? ' selected' : ''}>nofollow</option>
                    </select>
                </label>
                <label style="margin-left:16px;"><input type="checkbox" class="edit-spon" ${sponsored ? 'checked' : ''}> sponsored</label>
                <label style="margin-left:12px;"><input type="checkbox" class="edit-ugc" ${ugc ? 'checked' : ''}> ugc</label>
            </div>
           <div style="margin-bottom:18px;">
    <label><b>Open link</b>:
        <select class="edit-target" style="margin-left:8px;">
            <option value=""${target === '' ? ' selected' : ''}>in same tab</option>
            <option value="_blank"${target === '_blank' ? ' selected' : ''}>in new tab</option>
            <option value="_self"${target === '_self' ? ' selected' : ''}>(force same tab)</option>
        </select>
    </label>
</div>

            <div style="margin-bottom:18px;font-size:13px;color:#666;">
                <b>Found in:</b> ${link.permalink ? '<a href="' + escapeHtml(link.permalink) + '" target="_blank">' + escapeHtml(link.permalink.replace(/^https?:\/\/[^\/]+/, '')) + '</a>' : ''}
                <br><b>Excerpt:</b> ${escapeHtml(link.context)}
            </div>
            <div style="margin-top:18px;text-align:right;">
                <button class="wplm-save-link button button-primary" style="min-width:80px;" data-index="${index}">Save</button>
                <button class="wplm-cancel-link button" style="min-width:80px;margin-left:6px;">Cancel</button>
            </div>
        `;

        $('#wplm-modal').html(modalHtml);
        $('#wplm-modal-bg,#wplm-modal').fadeIn(150);

        // Save
        $('.wplm-save-link').off().on('click', function() {
            let $modal = $('#wplm-modal');
            let newAnchor = $modal.find('.edit-anchor').val();
            let newHref = $modal.find('.edit-href').val();
            let rel = [];
            let relType = $modal.find('.edit-rel-type').val();
            if (relType === 'nofollow') rel.push('nofollow');
            let sponsored = $modal.find('.edit-spon').is(':checked');
            let ugc = $modal.find('.edit-ugc').is(':checked');
            if (sponsored) rel.push('sponsored');
            if (ugc) rel.push('ugc');
            if (relType === 'dofollow' && !sponsored && !ugc) rel = [];
            let targetVal = $modal.find('.edit-target').val();
            let newAttrs = {};
            if (newHref) newAttrs.href = newHref;
            if (rel.length) newAttrs.rel = rel.join(' ');
            if (targetVal) newAttrs.target = targetVal;
            let scrollPos = $(window).scrollTop();
            saveLinkPatch(link, newAnchor, newHref, newAttrs, function() {
                renderTable(getCurrentFilteredLinks());
                $(window).scrollTop(scrollPos);
                showToast("Link updated!");
                $('#wplm-modal-bg,#wplm-modal').fadeOut(120);
            });
        });
        // Cancel/close
        $('.wplm-cancel-link,#wplm-modal-bg').off().on('click', function() {
            $('#wplm-modal-bg,#wplm-modal').fadeOut(120);
        });
        // ESC key to close
        $(document).off('keydown.wplmmodal').on('keydown.wplmmodal', function(e) {
            if (e.key === "Escape") {
                $('#wplm-modal-bg,#wplm-modal').fadeOut(120);
            }
        });
    }

    function getCurrentFilteredLinks() {
        let val = lastSearch;
        if (val && val.length) {
            val = val.toLowerCase();
            return allLinks.filter(link =>
                (link.anchor && link.anchor.toLowerCase().includes(val)) ||
                (link.href && link.href.toLowerCase().includes(val))
            );
        }
        return allLinks;
    }

    // Patch link via REST
    function saveLinkPatch(link, newAnchor, newHref, newAttrs, cb) {
        $.ajax({
            url: WPLM.rest_url + 'patch',
            method: 'POST',
            headers: {'X-WP-Nonce': WPLM.nonce},
            data: JSON.stringify({
                post_id: link.post_id,
                old_href: link.href,
                old_anchor: link.anchor,
                new_href: newHref,
                new_anchor: newAnchor,
                attributes: newAttrs
            }),
            contentType: 'application/json',
            success: function(data) {
                cb && cb();
            },
            error: function(xhr) {
                alert('Failed to patch link: ' +
                    (xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Unknown error'));
                cb && cb();
            }
        });
    }

    // Helpers for HTML attribute escaping
    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }
    function escapeHtml(str) {
        return String(str).replace(/[&<>"'`=\/]/g, function(s) {
            return ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
                "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;"
            })[s];
        });
    }

    function scrollToTopOfTable() {
        var $tbl = $('#no-bs-link-manager-app table');
        if ($tbl.length) {
            $('html,body').animate({scrollTop: $tbl.offset().top - 40}, 200);
        }
    }

    fetchLinks();
});
