# Transform Stream

The package exports a transform stream constructor that reads npm
public registry change objects and writes objects like:

```javascript
{
  sequence: Number,
  name: String,
  version: String,
  hasLicense: Boolean,
  license: Any
}
```

# HTTP Server

The package installs a `license-data-follower` bin script that follows
the npm public registry and serves JSON objects for requests like

    GET /package/{name}/{version}

and

    GET /package/{name}/{version}/{sequence}

The server emits [pino] log messages to standard streams and stores
data with [level].

[pino]: https://www.npmjs.com/package/pino

[level]: https://www.npmjs.com/package/level
