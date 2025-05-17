<?php
add_action('rest_api_init', function() {
    register_rest_route('no-bs-link-manager/v1', '/links', [
        'methods' => 'GET',
        'callback' => 'no_bs_link_manager_get_links',
        'permission_callback' => function() { return current_user_can('edit_posts'); }
    ]);
    register_rest_route('no-bs-link-manager/v1', '/patch', [
        'methods' => 'POST',
        'callback' => 'no_bs_link_manager_patch_link',
        'permission_callback' => function() { return current_user_can('edit_posts'); }
    ]);
});
