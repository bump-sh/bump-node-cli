import { expect, test } from '@oclif/test';
import { API } from '../../src/definition';
import nock from 'nock';
import path from 'path';

nock.disableNetConnect();

describe('API definition class', () => {
  describe('with inexistent file', () => {
    test
      .do(async () => await API.load('FILE'))
      .catch(
        (err) => {
          expect(err.message).to.match(/Error opening file/);
        },
        { raiseIfNotThrown: false },
      )
      .it('throws an error');
  });

  describe('with no references', () => {
    test.it('parses successfully an OpenAPI contract', async () => {
      const api = await API.load('examples/valid/openapi.v2.json');
      expect(api.version).to.equal('2.0');
      expect(api.references).to.be.an('array').that.is.empty;
    });

    test.it('parses successfully an AsyncAPI contract', async () => {
      const api = await API.load('examples/valid/asyncapi.v2.3.yml');
      expect(api.version).to.equal('2.3.0');
    });

    test.it('parses successfully an AsyncAPI 2.4 contract', async () => {
      nock.enableNetConnect('raw.githubusercontent.com');
      const api = await API.load(
        'https://raw.githubusercontent.com/asyncapi/spec/v2.4.0/examples/streetlights-kafka.yml',
      );
      nock.disableNetConnect();
      expect(api.version).to.equal('2.4.0');
    });

    test.it('parses successfully an AsyncAPI 2.5 contract', async () => {
      const api = await API.load('examples/valid/asyncapi.v2.5.yml');
      expect(api.version).to.equal('2.5.0');
    });
  });

  describe('with file & http references', () => {
    test
      .nock('http://example.org', (api) => api.get('/param-lights.json').reply(200, {}))
      .it('parses successfully', async () => {
        const api = await API.load('examples/valid/asyncapi.v2.yml');
        expect(api.version).to.equal('2.2.0');
        expect(api.references.length).to.equal(5);
        const locations = api.references.map((ref) => ref.location);
        expect(locations).to.include('http://example.org/param-lights.json');

        expect(locations).to.include(['params', 'streetlightId.json'].join(path.sep));

        expect(locations).to.not.include(
          ['.', 'params', 'streetlightId.json'].join(path.sep),
        );

        expect(locations).to.include(['doc', 'introduction.md'].join(path.sep));
      });
  });

  describe('with a relative descendant file path', () => {
    test.it('parses successfully', async () => {
      const api = await API.load('./examples/valid/openapi.v2.json');
      expect(api.version).to.equal('2.0');
    });
  });

  describe('with a file path containing special characters', () => {
    test.it('parses successfully', async () => {
      const api = await API.load('./examples/valid/__gitlab-é__.yml');
      expect(api.version).to.equal('3.0.0');
    });
  });

  describe('with an http file containing relative URL refs', () => {
    test
      .nock('http://example.org', (api) =>
        api
          .get('/openapi')
          .replyWithFile(200, 'examples/valid/openapi.v3.json', {
            'Content-Type': 'application/json',
          })
          .get('/schemas/all.yml')
          .replyWithFile(200, 'examples/valid/schemas/all.yml', {
            'Content-Type': 'application/yaml',
          }),
      )
      .it('parses external file successfully', async () => {
        const api = await API.load('http://example.org/openapi');
        expect(api.version).to.equal('3.0.2');
        expect(api.references.map((ref) => ref.location)).to.contain(
          ['schemas', 'all.yml'].join(path.sep),
        );
      });
  });

  describe('with an invalid definition file', () => {
    for (const [example, error] of Object.entries({
      './examples/invalid/openapi.yml': 'Unsupported API specification',
      './examples/invalid/array.yml': 'Unsupported API specification',
      './examples/invalid/string.yml': 'Unsupported API specification',
      './examples/valid/asyncapi.v3.yml': 'Unsupported API specification',
    })) {
      test
        .do(async () => await API.load(example))
        .catch(
          (err) => {
            expect(err.message).to.match(new RegExp(error));
          },
          { raiseIfNotThrown: false },
        )
        .it(`throws an error with details about ${example}`);
    }
  });
});
