# Church website images

Every file here was selected from the church's own WordPress media archive
(the 308-image export supplied with the redesign brief on 24 September 2026),
then resized to its display size and re-encoded (mozjpeg, progressive; PNG
for the transparent tulips, the white logo and the icons). The same bytes are
embedded in `../media-bytes.ts` so the static build, the authenticated local
preview, the loopback verification server and the sealed visitor runtime all
serve identical files at `/media/{file}`; `tests/church-site.test.ts` asserts
the two copies match. Alt text lives in `../media.ts`.

| Asset | Served at | Size | Original archive path |
| --- | --- | --- | --- |
| entrance | /media/entrance.jpg | 289×510 | 2024/05/Saving-Grace-Bible-Church-Entrance.png |
| congregation | /media/congregation.jpg | 1600×1204 | 2023/11/viber_image_2023-11-27_14-15-27-337.jpg |
| fellowship | /media/fellowship.jpg | 1400×788 | 2023/12/Saving-Grace-Bible-Church-fellowship-1.jpg |
| lords-day | /media/lords-day.jpg | 1400×933 | 2024/01/Saving-Grace-Bible-Church-Lords-Day-Service.jpg |
| merge | /media/merge.jpg | 1400×647 | 2023/11/SGBC-Merge.jpg |
| early-church | /media/early-church.jpg | 1600×452 | 2017/01/IMG20170730103903.png |
| wesam | /media/wesam.jpg | 640×666 | 2021/02/WesProfile.jpg |
| ralph | /media/ralph.jpg | 640×663 | 2021/02/Ralph.jpg |
| ralph-music | /media/ralph-music.jpg | 200×240 | 2023/12/Ralph-Music-Ministry-Profile-Photo.png |
| elders | /media/elders.jpg | 1200×675 | 2023/09/2.png |
| tulips | /media/tulips.png | 408×612 | 2023/09/pexels-photo-10874313-removebg-preview.png |
| books | /media/books.jpg | 1200×798 | 2023/12/luaakcuanvi.jpg |
| cross-sunset | /media/cross-sunset.jpg | 1600×429 | 2023/09/The-Gospel-2-1.jpg |
| bible-rose | /media/bible-rose.jpg | 640×960 | 2023/11/1xwvmneiyky.jpg |
| baptism-water | /media/baptism-water.jpg | 600×338 | 2023/11/WaterBaptism-1.png |
| open-bible | /media/open-bible.jpg | 1000×750 | 2023/09/pcfjkub5bes.jpg |
| cross-field | /media/cross-field.jpg | 1443×349 | 2023/09/Statement-of-faith-2-1.jpg |
| pen | /media/pen.jpg | 1000×659 | 2023/12/y3tl-cbu-cu.jpg |
| bible-shelf | /media/bible-shelf.jpg | 1600×333 | 2023/10/Bible-1.jpg |
| bible-study-invitation | /media/bible-study-invitation.jpg | 300×200 | 2025/08/Bible-Study-Invitation-by-Candlelight-e1754443070823.png |
| end-times | /media/end-times.jpg | 720×720 | 2025/08/SGBC-End-Times-Bible-Study-1.png |
| child-reading | /media/child-reading.jpg | 1000×668 | 2023/09/4k2lip0zc_k.jpg |
| good-news | /media/good-news.jpg | 675×675 | 2023/11/xmmsdtigsfo-e1701128615369.jpg |
| mens-ministry | /media/mens-ministry.jpg | 1000×668 | 2023/12/mo9vkbg5csg.jpg |
| womens-ministry | /media/womens-ministry.jpg | 1000×667 | 2023/12/u5e1kqw6e3m.jpg |
| mens-bible-study | /media/mens-bible-study.jpg | 800×533 | 2023/12/Mens-Bible-Study.jpg |
| womens-prayer | /media/womens-prayer.jpg | 600×400 | 2023/12/womens-prayer-group.jpg |
| teaching | /media/teaching.jpg | 1000×563 | 2024/06/claa-z0x52w.jpg |
| worship-team | /media/worship-team.jpg | 1200×600 | 2023/12/Music-Ministry-SGBC.jpg |
| music-sheet | /media/music-sheet.jpg | 800×534 | 2023/12/vnlzft8kcg.jpg |
| membership-roll | /media/membership-roll.jpg | 700×933 | 2023/12/yiftar2fjve.jpg |
| hands | /media/hands.jpg | 640×960 | 2023/09/g1-kch8gzna.jpg |
| evening-blossom | /media/evening-blossom.jpg | 1000×667 | 2023/12/1ngigjt7klq.jpg |
| sunset | /media/sunset.jpg | 1600×480 | 2023/09/Sunset-1.jpg |
| old-book | /media/old-book.jpg | 900×600 | 2023/12/d9sarvjfhm.jpg |
| grace | /media/grace.jpg | 1000×667 | 2024/01/wb_eymllxve.jpg |
| lit-cross | /media/lit-cross.jpg | 600×800 | 2023/11/Lordship-Salvation-1.jpg |
| welcome-door | /media/welcome-door.jpg | 900×1200 | 2023/11/viber_image_2023-11-27_14-18-21-471-1.jpg |
| fight-like-a-man | /media/fight-like-a-man.jpg | 302×466 | 2025/01/Fight-Like-A-Man.jpg |
| blessing-of-humility | /media/blessing-of-humility.jpg | 420×630 | 2025/01/Blessing-of-Humility-The-Bridges-Jerry.jpg |
| preaching-and-preachers | /media/preaching-and-preachers.jpg | 328×500 | 2024/12/PP-Martin-Loyd-Jones.png |
| called-to-preach | /media/called-to-preach.jpg | 400×618 | 2024/06/Called-To-Preach-SGBC-e1718157549928.jpg |
| logo-white | /media/logo-white.png | 300×178 | 2023/12/SGBC-Logo-White-1.png |
| favicon-32 | /brand/favicon-32.png | 32×32 | 2023/11/favicon-32x32-1.png |
| icon-192 | /brand/icon-192.png | 192×192 | 2023/11/cropped-SGBC-Logo-new-no-flick-favicon-small-1-1.jpg |

The supplied church logo (`../logo.ts`, served at `/brand/saving-grace-logo.png`)
is unchanged from the SermonsV4 handoff. `manifest.json` records the original
and optimised dimensions, byte counts and SHA-256 of every file.

Images from the archive that were reviewed and not used include theme
demonstration artwork, duplicate crops, screenshots, sermon title cards with
burned-in text, event flyers for past dates and stock photographs that did not
serve a page's content.
