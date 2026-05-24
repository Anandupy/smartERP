const fs = require('fs');
const file = 'postman/collections/ERP Backend.postman_collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const mastersList = [
    { name: 'Admission Source', path: 'admission-sources', varName: 'admissionSourceId', code: 'WKIN', defaultName: 'Walk-in' },
    { name: 'Blood Group', path: 'blood-groups', varName: 'bloodGroupId', code: 'OPOS', defaultName: 'O+' },
    { name: 'Caste', path: 'castes', varName: 'casteId', code: 'GEN', defaultName: 'General' },
    { name: 'Category', path: 'categories', varName: 'categoryId', code: 'OPEN', defaultName: 'Open Category' },
    { name: 'Disability', path: 'disabilities', varName: 'disabilityId', code: 'NONE', defaultName: 'None' },
    { name: 'Gender', path: 'genders', varName: 'genderId', code: 'MALE', defaultName: 'Male' },
    { name: 'Language', path: 'languages', varName: 'languageId', code: 'EN', defaultName: 'English' },
    { name: 'Quota', path: 'quotas', varName: 'quotaId', code: 'MGMT', defaultName: 'Management Quota' },
    { name: 'Relation Type', path: 'relation-types', varName: 'relationTypeId', code: 'FATH', defaultName: 'Father' },
    // religion is already handled, but we can regenerate it perfectly just in case, but let's skip religion if it exists
];

const admissions = data.item.find(i => i.name === 'Admissions');
if (admissions) {
  let masters = admissions.item.find(i => i.name === 'Masters');
  if (!masters) {
      masters = { name: 'Masters', item: [] };
      admissions.item.push(masters);
  }
  
  // Clear existing items in Masters to rebuild them beautifully in folders
  masters.item = [];

  // Add Religion as well to keep them all in folders uniformly
  mastersList.push({ name: 'Religion', path: 'religions', varName: 'religionId', code: 'HIND', defaultName: 'Hinduism' });

  mastersList.forEach(master => {
      const folder = {
          name: master.name,
          item: [
              {
                  name: `Create ${master.name}`,
                  event: [
                      {
                          listen: 'test',
                          script: {
                              exec: [
                                  'const response = pm.response.json();',
                                  'if (response.success && response.data) {',
                                  `    pm.environment.set("${master.varName}", response.data.id);`,
                                  '}'
                              ],
                              type: 'text/javascript'
                          }
                      }
                  ],
                  request: {
                      method: 'POST',
                      header: [],
                      body: {
                          mode: 'raw',
                          raw: JSON.stringify({ code: master.code, name: master.defaultName, displayOrder: 1 }, null, 4),
                          options: { raw: { language: 'json' } }
                      },
                      url: {
                          raw: `{{baseUrl}}/admissions/masters/${master.path}`,
                          host: ['{{baseUrl}}'],
                          path: ['admissions', 'masters', master.path]
                      }
                  }
              },
              {
                  name: `List ${master.name}s`,
                  request: {
                      method: 'GET',
                      header: [],
                      url: {
                          raw: `{{baseUrl}}/admissions/masters/${master.path}`,
                          host: ['{{baseUrl}}'],
                          path: ['admissions', 'masters', master.path]
                      }
                  }
              },
              {
                  name: `Get ${master.name} By ID`,
                  request: {
                      method: 'GET',
                      header: [],
                      url: {
                          raw: `{{baseUrl}}/admissions/masters/${master.path}/{{${master.varName}}}`,
                          host: ['{{baseUrl}}'],
                          path: ['admissions', 'masters', master.path, `{{${master.varName}}}`]
                      }
                  }
              },
              {
                  name: `Update ${master.name}`,
                  request: {
                      method: 'PATCH',
                      header: [],
                      body: {
                          mode: 'raw',
                          raw: JSON.stringify({ name: `${master.defaultName} Updated` }, null, 4),
                          options: { raw: { language: 'json' } }
                      },
                      url: {
                          raw: `{{baseUrl}}/admissions/masters/${master.path}/{{${master.varName}}}`,
                          host: ['{{baseUrl}}'],
                          path: ['admissions', 'masters', master.path, `{{${master.varName}}}`]
                      }
                  }
              },
              {
                  name: `Delete ${master.name}`,
                  request: {
                      method: 'DELETE',
                      header: [],
                      url: {
                          raw: `{{baseUrl}}/admissions/masters/${master.path}/{{${master.varName}}}`,
                          host: ['{{baseUrl}}'],
                          path: ['admissions', 'masters', master.path, `{{${master.varName}}}`]
                      }
                  }
              }
          ]
      };
      masters.item.push(folder);
  });
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Postman collection successfully updated with all Master modules.');
