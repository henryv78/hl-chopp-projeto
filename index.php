<?php
// O site no GitHub Pages usa index.html (demonstração).
// No XAMPP, index.php usa os mesmos arquivos e ativa o banco MySQL.
$html = file_get_contents(__DIR__ . '/index.html');
$html = str_replace('<script src="js/app.js"></script>', '<script>window.HL_MODE = "mysql";</script><script src="js/app.js"></script>', $html);
echo $html;
