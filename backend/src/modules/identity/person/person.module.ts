import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';

/**
 * The identity index.
 *
 * Depends on crypto and numbering infrastructure and on nothing else. It must
 * never import Applicant, Student, Admission or Enrollment — those modules
 * depend on Person, and an edge back would make the identity foundation
 * unbuildable without the things built on top of it.
 */
@Module({
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}
