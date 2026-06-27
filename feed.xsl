<?xml version="1.0" encoding="UTF-8"?>
<!--
  LanorTrad — Feuille de style du flux RSS.
  Le navigateur applique ce XSLT quand un humain ouvre feed.xml : il voit une
  jolie page (et non du XML brut). Les agrégateurs (Feedly, etc.) ignorent le
  XSLT et lisent le RSS normalement. feed.xml reste un flux RSS 2.0 valide.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/rss/channel">
    <html lang="fr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="title"/></title>
        <meta name="robots" content="noindex"/>
        <link rel="icon" href="images/icons/icon-192x192.png"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Sora:wght@600;700;800&amp;display=swap" rel="stylesheet"/>
        <style>
          :root{
            --bg-0:#0b0b16; --bg-1:#12121f; --bg-2:#181826; --line:rgba(255,255,255,.08);
            --line-strong:rgba(255,255,255,.14); --txt:#ece9f5; --txt-soft:#b6b3c7;
            --txt-mut:#807d93; --violet:#a855f7; --grad:linear-gradient(120deg,#a855f7,#6366f1);
          }
          *{box-sizing:border-box;margin:0;padding:0}
          body{
            font-family:'Inter',system-ui,sans-serif; background:var(--bg-0); color:var(--txt);
            line-height:1.6; min-height:100vh;
            background-image:radial-gradient(60vw 60vw at 80% -10%,rgba(168,85,247,.12),transparent 60%),
                             radial-gradient(50vw 50vw at -10% 110%,rgba(99,102,241,.12),transparent 60%);
          }
          .wrap{max-width:760px;margin:0 auto;padding:48px 22px 80px}
          .note{
            display:flex;gap:12px;align-items:flex-start; font-size:.9rem; color:var(--txt-soft);
            background:var(--bg-2); border:1px solid var(--line-strong); border-radius:14px;
            padding:14px 16px; margin-bottom:30px;
          }
          .note b{color:var(--txt)}
          .note .ic{font-size:1.2rem;line-height:1.2;flex:none}
          header.feed-head{margin-bottom:14px}
          .eyebrow{
            display:inline-block; font-family:'Sora',sans-serif; font-weight:700; font-size:.72rem;
            letter-spacing:.16em; text-transform:uppercase; color:var(--violet); margin-bottom:10px;
          }
          h1{
            font-family:'Sora',sans-serif; font-weight:800; font-size:clamp(1.7rem,5vw,2.4rem);
            line-height:1.15; letter-spacing:-.02em;
          }
          h1 .grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
          .lede{color:var(--txt-soft);margin-top:8px;max-width:54ch}
          .home{
            display:inline-flex;align-items:center;gap:7px;margin-top:18px; text-decoration:none;
            font-weight:600;font-size:.92rem;color:#fff; padding:10px 18px;border-radius:999px;
            background:var(--grad); box-shadow:0 12px 30px -12px rgba(124,58,237,.7);
          }
          .home:hover{filter:brightness(1.07)}
          .items{list-style:none;margin-top:34px;display:flex;flex-direction:column;gap:12px}
          .item{
            display:block; text-decoration:none; color:inherit; padding:16px 18px; border-radius:16px;
            background:var(--bg-2); border:1px solid var(--line); transition:transform .2s,border-color .2s,box-shadow .2s;
          }
          .item:hover{transform:translateY(-3px);border-color:rgba(168,85,247,.45);box-shadow:0 18px 40px -24px rgba(168,85,247,.6)}
          .item-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
          .item-title{font-family:'Sora',sans-serif;font-weight:700;font-size:1.12rem;color:var(--txt)}
          .item-date{font-size:.78rem;color:var(--txt-mut);white-space:nowrap}
          .item-desc{display:block;color:var(--txt-soft);font-size:.92rem;margin-top:5px}
          .item-go{display:block;color:var(--violet);font-weight:600;font-size:.85rem;margin-top:10px}
          footer.feed-foot{margin-top:46px;text-align:center;color:var(--txt-mut);font-size:.8rem}
          footer.feed-foot a{color:var(--txt-soft)}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="note">
            <span class="ic">📡</span>
            <span>Ceci est le <b>flux RSS</b> de LanorTrad. Copiez l'adresse de cette page
              dans votre lecteur de flux (Feedly, Inoreader…) pour être prévenu des nouvelles
              sorties. Vous pouvez aussi simplement parcourir les dernières sorties ci-dessous.</span>
          </div>

          <header class="feed-head">
            <span class="eyebrow">Flux des sorties</span>
            <h1>Lanor<span class="grad">Trad</span> — Nouveaux chapitres</h1>
            <p class="lede"><xsl:value-of select="description"/></p>
            <a class="home" href="index.html">
              ← Retour au site
            </a>
          </header>

          <ul class="items">
            <xsl:for-each select="item">
              <li>
                <a class="item">
                  <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                  <span class="item-top">
                    <span class="item-title"><xsl:value-of select="title"/></span>
                    <span class="item-date"><xsl:value-of select="substring(pubDate, 1, 16)"/></span>
                  </span>
                  <span class="item-desc"><xsl:value-of select="description"/></span>
                  <span class="item-go">Lire la série →</span>
                </a>
              </li>
            </xsl:for-each>
          </ul>

          <footer class="feed-foot">
            <p>LanorTrad · <a href="index.html">lanortrad.com</a> — scantrad français, lecture gratuite.</p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
