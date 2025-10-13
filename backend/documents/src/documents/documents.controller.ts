import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentsQueue: DocumentsQueueService,
  ) {}

  @Get()
  async findAll(@Query() query: ListDocumentsDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateDocumentDto) {
    const document = await this.documentsService.create(dto);
    if (dto.enqueueUpload ?? true) {
      await this.documentsQueue.enqueueUpload(document.id, dto.metadata);
    }
    return document;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.documentsService.remove(id);
    return { id };
  }

  @Post(':id/upload')
  async upload(@Param('id') id: string) {
    await this.documentsQueue.enqueueUpload(id);
    return { id, status: 'queued' };
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string) {
    await this.documentsQueue.enqueueSync(id);
    return { id, status: 'queued' };
  }
}
