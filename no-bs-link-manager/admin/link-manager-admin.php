<?php
// Add menu page
add_action('admin_menu', function() {
    add_menu_page(
        'No BS Link Manager',
        'Link Manager',
        'manage_options',
        'no-bs-link-manager',
        'no_bs_link_manager_render_admin_page',
        'dashicons-admin-links',
        65
    );
});

function no_bs_link_manager_render_admin_page() {
    ?>
    <div class="wrap">
        <h1>No BS Link Manager</h1>
        <div id="no-bs-link-manager-app"></div>
    </div>
    <?php
    // Enqueue our admin JS & CSS only on this page
    wp_enqueue_script('link-manager-admin', plugin_dir_url(__FILE__) . 'link-manager-admin.js', ['jquery'], '1.0', true);
    wp_localize_script('link-manager-admin', 'WPLM', [
        'nonce' => wp_create_nonce('wp_rest'),
        'rest_url' => rest_url('no-bs-link-manager/v1/')
    ]);
    wp_enqueue_style('link-manager-admin-css', plugin_dir_url(__DIR__) . 'assets/link-manager-admin.css');
}
