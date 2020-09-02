const getLanguages = () => JSON.parse(`{
    "data": [
      {
        "id": "l:en_US",
        "type": "languages",
        "attributes": {
          "code": "en",
          "name": "English",
          "plural_equation": "(n != 1)",
          "plural_rules": {},
          "rtl": false
        },
        "links": {
          "self": "/languages/l:en_US"
        }
      }
    ]
  }`);

const getProjectLanguageTranslations = () => JSON.parse(`{
    "data": [
      {
        "attributes": {
          "date_created": "XXXX-XX-XXTXX:XX:XXZ",
          "date_proofread": "XXXX-XX-XXTXX:XX:XXZ",
          "date_reviewed": "XXXX-XX-XXTXX:XX:XXZ",
          "date_translated": "XXXX-XX-XXTXX:XX:XXZ",
          "finalized": false,
          "proofread": false,
          "reviewed": true,
          "strings": {
            "one": "hello",
            "other": "world"
          }
        },
        "id": "o:oslug:p:pslug:r:rslug:s:shash:l:el_GR",
        "links": {
          "self": "/resource_translations/o:oslug:p:pslug:r:rslug:s:shash:l:language_code"
        },
        "relationships": {
          "language": {
            "data": {
              "id": "l:en_US",
              "type": "languages"
            },
            "links": {
              "related": "/languages/l:en_US"
            }
          },
          "proofreader": {
            "data": {
              "id": "u:user_1",
              "type": "users"
            },
            "links": {
              "related": "/users/u:user_1"
            }
          },
          "resource": {
            "data": {
              "id": "o:oslug:p:pslug:r:rslug",
              "type": "resources"
            },
            "links": {
              "related": "/resources/o:oslug:p:pslug:r:rslug"
            }
          },
          "resource_string": {
            "data": {
              "id": "o:oslug:p:pslug:r:rslug:s:shash",
              "type": "resource_strings"
            },
            "links": {
              "related": "/resource_strings/o:oslug:p:pslug:r:rslug:s:shash"
            }
          },
          "reviewer": {
            "data": {
              "id": "u:user_1",
              "type": "users"
            },
            "links": {
              "related": "/users/u:user_1"
            }
          },
          "translator": {
            "data": {
              "id": "u:user_1",
              "type": "users"
            },
            "links": {
              "related": "/users/u:user_1"
            }
          }
        },
        "type": "resource_translations"
      }
    ],
    "included": [
      {
        "attributes": {
          "appearance_order": 0,
          "character_limit": 100,
          "context": [
            "frontpage",
            "footer",
            "verb"
          ],
          "date_created": "XXXX-XX-XXTXX:XX:XXZ",
          "developer_comment": "Wrapped in a 30px width div",
          "instructions": "Please use causal language for translations.",
          "key": "hello_world",
          "metadata_date_modified": "XXXX-XX-XXTXX:XX:XXZ",
          "occurrences": "/my_project/templates/frontpage/hello.html:30",
          "pluralized": true,
          "string_hash": "2e354ef120752c67afa1b6855aa80c52",
          "strings": {
            "one": "hello",
            "other": "world"
          },
          "strings_date_modified": "XXXX-XX-XXTXX:XX:XXZ",
          "tags": [
            "foo",
            "bar"
          ]
        },
        "id": "o:oslug:p:pslug:r:rslug:s:shash",
        "links": {
          "self": "/resource_strings/o:oslug:p:pslug:r:rslug:s:shash"
        },
        "relationships": {
          "committer": {
            "data": {
              "id": "u:user_1",
              "type": "users"
            },
            "links": {
              "related": "/users/u:user_1"
            }
          },
          "language": {
            "data": {
              "id": "l:en_US",
              "type": "languages"
            },
            "links": {
              "related": "/languages/l:en_US"
            }
          },
          "resource": {
            "data": {
              "id": "o:oslug:p:pslug:r:rslug",
              "type": "resources"
            },
            "links": {
              "related": "/resources/o:oslug:p:pslug:r:rslug"
            }
          }
        },
        "type": "resource_strings"
      }
    ],
    "links": {
      "self": "/resource_strings?filter[resource]=o:oslug:p:pslug:r:rslug"
    }
  }`);

const getPushSourceContent = () => JSON.parse(`{
    "somekey": {
      "string": "I am a string",
      "meta": {
        "context": ["context1", "context2"],
        "developer_comment": "Some notes",
        "tags": ["tag1", "tag2"],
        "character_limit": 33,
        "instructions": "some instructions"
      }
    },
    "hello_world": {
      "string": "{cnt, plural, one {hello} other {world}}",
      "meta": {
        "context": [ "frontpage", "footer", "verb" ],
        "character_limit": 100,
        "tags": [ "foo", "bar" ],
        "developer_comment": "Wrapped in a 30px width div",
        "occurrences": ["/my_project/templates/frontpage/hello.html:30"]
      }
    }
  }`);

const getSourceString = () => JSON.parse(`{
    "data": [
      {
        "attributes": {
          "appearance_order": 0,
          "character_limit": 100,
          "context": [
            "frontpage",
            "footer",
            "verb"
          ],
          "date_created": "XXXX-XX-XXTXX:XX:XXZ",
          "developer_comment": "Wrapped in a 30px width div",
          "instructions": "Please use causal language for translations.",
          "key": "hello_world",
          "metadata_date_modified": "XXXX-XX-XXTXX:XX:XXZ",
          "occurrences": "/my_project/templates/frontpage/hello.html:30",
          "pluralized": true,
          "string_hash": "2e354ef120752c67afa1b6855aa80c52",
          "strings": {
            "one": "hello",
            "other": "world"
          },
          "strings_date_modified": "XXXX-XX-XXTXX:XX:XXZ",
          "tags": [
            "foo",
            "bar"
          ]
        },
        "id": "o:oslug:p:pslug:r:rslug:s:shash",
        "links": {
          "self": "/resource_strings/o:oslug:p:pslug:r:rslug:s:shash"
        },
        "relationships": {
          "committer": {
            "data": {
              "id": "u:user_1",
              "type": "users"
            },
            "links": {
              "related": "/users/u:user_1"
            }
          },
          "language": {
            "data": {
              "id": "l:en_US",
              "type": "languages"
            },
            "links": {
              "related": "/languages/l:en_US"
            }
          },
          "resource": {
            "data": {
              "id": "o:oslug:p:pslug:r:rslug",
              "type": "resources"
            },
            "links": {
              "related": "/resources/o:oslug:p:pslug:r:rslug"
            }
          }
        },
        "type": "resource_strings"
      }
    ],
    "links": {
      "previous": "/resource_strings?filter[resource]=o:oslug:p:pslug:r:rslug&page[cursor]=XXX",
      "self": "/resource_strings?filter[resource]=o:oslug:p:pslug:r:rslug"
    }
  }`);

module.exports = {
  getLanguages,
  getProjectLanguageTranslations,
  getPushSourceContent,
  getSourceString,
};
