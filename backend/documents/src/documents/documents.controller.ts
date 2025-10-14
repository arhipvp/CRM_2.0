import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

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
    const { document, uploadUrl, expiresIn } = await this.documentsService.create(dto);
    await this.documentsQueue.enqueueUpload(document.id, document.metadata ?? undefined);

    return {
      document_id: document.id,
      upload_url: uploadUrl,
      expires_in: expiresIn,
    };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.documentsService.remove(id);
  }

  @Post(':id/upload')
  async upload(@Param('id') id: string) {
    await this.documentsQueue.enqueueUpload(id);
    return { id, status: 'queued' };
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body() dto: CompleteUploadDto) {
    const document = await this.documentsService.completeUpload(id, dto);
    await this.documentsQueue.enqueueSync(document.id);
    return document;
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string) {
    await this.documentsQueue.enqueueSync(id);
    return { id, status: 'queued' };
  }
}
