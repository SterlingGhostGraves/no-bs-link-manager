<?php
// Utility: Parse all <a> tags in post content
function no_bs_link_manager_get_links($request) {
    global $wpdb;

    $post_types = ['post', 'page']; // Add more as needed
    $posts = $wpdb->get_results("
        SELECT ID, post_name, post_title, post_content, post_type
        FROM $wpdb->posts
        WHERE post_status = 'publish'
        AND post_type IN ('" . implode("','", $post_types) . "')
        LIMIT 1000
    ");

    $allowed_attrs = ['href', 'rel', 'target', 'class', 'id'];
    $all_links = [];

    foreach ($posts as $post) {
        $matches = [];
        preg_match_all('/<a\s+([^>]+)>(.*?)<\/a>/is', $post->post_content, $matches, PREG_SET_ORDER);
        foreach ($matches as $m) {
    $attrs = [];
    preg_match_all('/([a-zA-Z0-9\-_]+)\s*=\s*(".*?"|\'.*?\'|[^\s>]+)/', $m[1], $attr_matches, PREG_SET_ORDER);
    foreach ($attr_matches as $a) {
        $attr_name = strtolower($a[1]);
        $attr_val = trim($a[2], "\"'");
        $attrs[$attr_name] = $attr_val;
    }

    // Get clean anchor text for display
    $anchorText = trim(strip_tags($m[2]));
    if ($anchorText === '') {
        if (preg_match('/<img/i', $m[2])) {
            $anchorText = '[Image]';
        } else {
            $anchorText = '[No Text]';
        }
    }

    // Get excerpt context (same as before)
    $pos = strpos($post->post_content, $m[0]);
    $context = '';
    if ($pos !== false) {
        $start = max(0, $pos - 40);
        $length = strlen($m[0]) + 80;
        $context = substr($post->post_content, $start, $length);
        $context = strip_tags($context);
        $context = preg_replace('/\s+/', ' ', $context);
        if ($start > 0) $context = '…' . $context;
        if ($pos + strlen($m[0]) + 40 < strlen($post->post_content)) $context .= '…';
    }

    // Get permalink (full URL)
    $permalink = get_permalink($post->ID);

    $all_links[] = [
        'post_id'    => $post->ID,
        'post_slug'  => $post->post_name,
        'post_type'  => $post->post_type,
        'anchor'     => $anchorText,
        'attrs'      => $attrs,
        'href'       => isset($attrs['href']) ? $attrs['href'] : '',
        'raw'        => $m[0],
        'context'    => $context,
        'permalink'  => $permalink,
    ];
}

    }
    return rest_ensure_response($all_links);
}

// Utility: Patch link in post content (by post ID and old href/anchor)
function no_bs_link_manager_patch_link($request) {
    $post_id = intval($request['post_id']);
    $old_href = esc_url_raw($request['old_href']);
    $old_anchor = sanitize_text_field($request['old_anchor']);
    $new_href = esc_url_raw($request['new_href']);
    $new_anchor = sanitize_text_field($request['new_anchor']);
    $attributes = is_array($request['attributes']) ? $request['attributes'] : [];

    // Build regex to match the exact <a> tag
    $content = get_post_field('post_content', $post_id);
    $pattern = '/<a\s+([^>]*href\s*=\s*[\'"]'.preg_quote($old_href, '/').'[\'"][^>]*)>'.preg_quote($old_anchor, '/').'<\/a>/is';

    // Build new <a> tag (only allow whitelisted attributes)
    $allowed_attrs = ['href', 'rel', 'target', 'class', 'id'];
    $attr_str = '';
    foreach ($allowed_attrs as $attr) {
        if (isset($attributes[$attr]) && $attributes[$attr] !== '') {
            $attr_str .= ' ' . $attr . '="' . esc_attr($attributes[$attr]) . '"';
        }
    }
    // Fallback: always ensure href present
    if (strpos($attr_str, 'href=') === false && !empty($new_href)) {
        $attr_str = ' href="' . esc_url($new_href) . '"' . $attr_str;
    }

    $replacement = '<a' . $attr_str . '>' . $new_anchor . '</a>';
    $new_content = preg_replace($pattern, $replacement, $content, 1);

    if ($new_content && $new_content !== $content) {
        wp_update_post([
            'ID' => $post_id,
            'post_content' => $new_content
        ]);
        return rest_ensure_response(['success' => true]);
    } else {
        return new WP_Error('link_not_found', 'Link not found or unchanged.', ['status' => 404]);
    }
}
