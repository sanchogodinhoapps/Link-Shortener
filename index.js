const favicon = require('serve-favicon');
const express = require('express');
const { Deta } = require('deta');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

app = express();
app.set('view engine', 'ejs');
app.use(express.json({ limit: '1mb' }));
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'icon.png')));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const deta = Deta(process.env.DETA_BASE_KEY);
const Links = deta.Base('links');
const AuthLinks = deta.Base('Temporary Links');

generateUUID = async () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let uuid = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) {
            uuid += '-';
        }
        uuid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (await Links.get(uuid) == null) {
        return uuid;
    }
    else {
        generateUUID();
    }
}

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/new', async (req, res) => {
    if (req.body.url != null && req.body.expires != null && req.body.short != null) {
        if (req.body.url.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g) != null) {
            let id;
            if (req.body.short.trim() != '') {
                if (await Links.get(req.body.short.trim().replaceAll(' ', '')) == null && req.body.short.trim() != 'clear') {
                    id = req.body.short.trim().replaceAll(' ', '');
                }
                else {
                    res.send({ success: false, error: 'URL Ending Already Used' });
                }
            }
            else {
                id = await generateUUID();
            }

            if (id != null && id.trim() != '') {
                if (req.body.expires.trim() != '' && req.body.expires.trim() != 'never') {
                    await Links.put({
                        key: id,
                        url: req.body.url,
                        lastAccessed: new Date()
                    }, '', {
                        expireIn: parseInt(req.body.expires)
                    });
                    res.send({ success: true, link: 'https://l.top/' + id });
                }
                else {
                    await Links.put({
                        key: id,
                        url: req.body.url,
                        lastAccessed: new Date()
                    });
                    res.send({ success: true, link: 'https://l.top/' + id });
                }
            }
        }
        else {
            res.send({ success: false, error: 'Invalid Request' });
        }
    }
    else {
        res.send({ success: false, error: 'Invalid Request' });
    }
});

app.get('/clear', async (req, res) => {
    if (req.query.pass != null) {
        if (req.query.pass == process.env.CLEAR_PASSWORD) {
            let links = await Links.fetch();
            links.items.forEach(async link => {
                if (link.__expires == null || link.__expires == undefined) {
                    let oneYearInMs = 365 * 24 * 60 * 60 * 1000;
                    let linkLastAccessed = new Date(link.lastAccessed).getTime();

                    if (Date.now() - linkLastAccessed >= oneYearInMs) {
                        await Links.delete(link.key);
                    }
                }
            });
            res.send({ ok: true });
        }
        else {
            res.redirect('/');
        }
    }
    else {
        res.redirect('/');
    }
});

app.get('/:link', async (req, res) => {
    if (req.params.link != null && req.params.link.trim() != '') {
        let link = await Links.get(req.params.link);
        if (link != null) {
            res.render('link', { url: link.url });
        }
        else {
            res.redirect('/');
        }
    }
    else {
        res.redirect('/');
    }
});

app.listen(8080);