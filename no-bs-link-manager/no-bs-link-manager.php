<?php
/*
Plugin Name: NO BS Link Manager
Description: The visual link manager for real people—edit internal & external links, anchors, and attributes in bulk, no paywalls, no hidden fees. Made for everyone tired of “premium” features locked behind SaaS and endless upsells.
Version: 1.0
Author: Dalton Barron
Author URI: https://daltonbarron.com
Plugin URI: https://daltonbarron.com/no-bs-link-manager
*/

/*
---------------------------------------------------------------------------------------------------
NO BS Link Manager

What happens when a blue-collar working-class man, fed up with every “feature” being a paid upgrade,
grabs YouTube, ChatGPT, and a little code? He builds the tool he needed—no SaaS, no paywall, no BS.

Why does this matter to you?
Because I know what it’s like to skip features because of yet another $7/month upgrade,
or to see “premium” behind every useful button. I built this for myself, and now I’m sharing it with you.

• NO features are behind a paywall.  
• NO email opt-ins required.  
• NO “pro” upgrade nags.  
• Just a plugin that works—for free, forever, as long as I can keep it up.

Yes, there are ads and donation links in the plugin. They don’t unlock extra features—everyone gets the same, always.
That’s the deal. If you like it, great. If you don’t, fork it, make it your own, or just uninstall.

Enjoy, and let’s keep WordPress honest.
— Dalton Barron
---------------------------------------------------------------------------------------------------
*/


// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Include dependencies
require_once plugin_dir_path(__FILE__) . 'admin/link-manager-admin.php';
require_once plugin_dir_path(__FILE__) . 'includes/link-manager-rest.php';
require_once plugin_dir_path(__FILE__) . 'includes/link-manager-utils.php';
add_action('admin_enqueue_scripts', function($hook) {
    // Adjust the 'toplevel_page_no-bs-link-manager' to match your admin page if needed.
    if ($hook === 'toplevel_page_no-bs-link-manager') {
        wp_enqueue_style(
            'wplm-admin-css',
            plugins_url('admin/link-manager-admin.css', __FILE__),
            [],
            filemtime(plugin_dir_path(__FILE__) . 'admin/link-manager-admin.css')
        );
    }
});
