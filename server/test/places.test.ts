import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMember,
  agentFor,
  createHousehold,
  createProject,
  registerUser,
  resetDb,
  roleId,
} from './helpers';

beforeEach(resetDb);

const FULL_PLACE = {
  name: 'Dr. Levi (family doctor)',
  category: 'medical',
  contactName: 'Dr. Dana Levi',
  phone: '03-555-1234',
  phoneAlt: '050-555-6789',
  email: 'clinic@example.com',
  website: 'https://clinic.example.com',
  address: 'Herzl 5, floor 2',
  city: 'Tel Aviv',
  postalCode: '6100001',
  openingHours: 'Sun–Thu 8:00–16:00',
  notes: 'Bring the kids’ vaccination cards.',
  isFavorite: true,
};

const setup = async () => {
  const parent = agentFor();
  await registerUser(parent);
  const home = await createHousehold(parent);
  const join = async (systemKey: string) => {
    const agent = agentFor();
    const account = await registerUser(agent);
    await addMember(parent, home.key, account.email, roleId(home, systemKey));
    return agent;
  };
  return { parent, home, child: await join('member'), guest: await join('viewer') };
};

describe('household places', () => {
  it('saves a place with only a name and fills the rest with blanks', async () => {
    const { parent, home } = await setup();
    const { body } = await parent
      .post(`/api/projects/${home.key}/places`)
      .send({ name: 'Pharmacy' })
      .expect(201);
    expect(body.place).toMatchObject({
      name: 'Pharmacy',
      category: 'other',
      contactName: '',
      phone: '',
      phoneAlt: '',
      email: '',
      website: '',
      address: '',
      city: '',
      postalCode: '',
      openingHours: '',
      notes: '',
      isFavorite: false,
    });
  });

  it('keeps every field, edits one, lists favorites first and deletes', async () => {
    const { parent, home } = await setup();
    const path = `/api/projects/${home.key}/places`;
    await parent.post(path).send({ name: 'Bakery', category: 'food' }).expect(201);
    const { body } = await parent.post(path).send(FULL_PLACE).expect(201);
    expect(body.place).toMatchObject(FULL_PLACE);

    const edited = await parent.patch(`${path}/${body.place.id}`).send({ phone: '03-555-0000' }).expect(200);
    expect(edited.body.place).toMatchObject({ ...FULL_PLACE, phone: '03-555-0000' });

    const listed = await parent.get(path).expect(200);
    expect(listed.body.places.map((place: { name: string }) => place.name)).toEqual([
      FULL_PLACE.name,
      'Bakery',
    ]);

    await parent.delete(`${path}/${body.place.id}`).expect(204);
    await parent.delete(`${path}/${body.place.id}`).expect(404);
    expect((await parent.get(path).expect(200)).body.places).toHaveLength(1);
  });

  it('lets members who edit lists change places, guests only read them, outsiders see nothing', async () => {
    const { parent, home, child, guest } = await setup();
    const path = `/api/projects/${home.key}/places`;
    await child.post(path).send({ name: 'School' }).expect(201);
    await guest.post(path).send({ name: 'Nope' }).expect(403);
    expect((await guest.get(path).expect(200)).body.places).toHaveLength(1);
    const outsider = agentFor();
    await registerUser(outsider);
    await outsider.get(path).expect(404);
    await parent.get(path).expect(200);
  });

  it('rejects a bad email, a non-web link and an unknown category', async () => {
    const { parent, home } = await setup();
    const path = `/api/projects/${home.key}/places`;
    await parent.post(path).send({ name: 'X', email: 'not-an-email' }).expect(400);
    await parent.post(path).send({ name: 'X', website: 'javascript:alert(1)' }).expect(400);
    await parent.post(path).send({ name: 'X', category: 'spaceport' }).expect(400);
    await parent.post(path).send({ name: '' }).expect(400);
  });

  it('exists only in households', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await createProject(agent, { key: 'SOFT' });
    await agent.get('/api/projects/SOFT/places').expect(404);
    await agent.post('/api/projects/SOFT/places').send({ name: 'Office' }).expect(404);
  });
});
